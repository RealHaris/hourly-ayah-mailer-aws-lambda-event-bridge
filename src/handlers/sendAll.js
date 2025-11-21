'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah, listContacts } = require('../lib/dynamo');
const { buildReflectionEmailContent, sendEmail } = require('../lib/email');

function json(statusCode, body) {
	return {
		statusCode,
		headers: {
			'Content-Type': 'application/json',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': '*'
		},
		body: JSON.stringify(body)
	};
}

function getBaseUrl(event) {
	try {
		console.log('[sendAll] Getting base URL', { event });
		const headers = (event && event.headers) || {};
		const proto = headers['x-forwarded-proto'] || headers['X-Forwarded-Proto'] || 'https';
		const host = headers.host || headers.Host;
		const stage = (event && event.requestContext && event.requestContext.stage) || '';
		if (host) {
			return `${proto}://${host}${stage && stage !== '$default' ? `/${stage}` : ''}`;
		}
	} catch {
		// ignore
	}
	return '';
}

exports.handler = async (event) => {
	try {
		const ayah = await getRandomAyah();
		const record = {
			id: randomUUID(),
			createdAt: new Date().toISOString(),
			...ayah
		};
		await putAyah(record);

		const contacts = await listContacts();
		const valid = contacts.filter((c) => c && c.email && c.id);

		if (valid.length === 0) {
			return json(200, { ok: true, message: 'No contacts found; nothing to send.' });
		}

		const baseUrl = getBaseUrl(event) || process.env.HTTP_API_URL || '';
		const batchSize = 5;
		const results = [];
		for (let i = 0; i < valid.length; i += batchSize) {
			const chunk = valid.slice(i, i + batchSize);
			// eslint-disable-next-line no-await-in-loop
			const settled = await Promise.allSettled(
				chunk.map((c) => {
					const unsubscribeUrl = baseUrl ? `${baseUrl}/unsubscribe?id=${encodeURIComponent(c.id)}` : '#';
					const { subject, html, text } = buildReflectionEmailContent(ayah, unsubscribeUrl, c.name, true);
					return sendEmail({ to: c.email, subject, html, text });
				})
			);
			for (let j = 0; j < settled.length; j += 1) {
				const to = chunk[j].email;
				const outcome = settled[j];
				results.push({
					to,
					ok: outcome.status === 'fulfilled',
					error: outcome.status === 'rejected' ? String(outcome.reason) : undefined
				});
			}
		}

		const ok = results.filter((r) => r.ok).length;
		const failed = results.length - ok;

		return json(200, { ok: true, sent: ok, failed, details: results });
	} catch (err) {
		console.error(err);
		return json(500, { ok: false, error: String(err) });
	}
};


