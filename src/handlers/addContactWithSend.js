'use strict';

const { randomUUID } = require('crypto');
const http = require('../lib/http');
const { addContact } = require('../lib/dynamo');
const { validateAddContact } = require('../lib/validation');
const { getRandomAyah } = require('../lib/quran');
const { putAyah } = require('../lib/dynamo');
const { sendEmail, buildReflectionEmailContent } = require('../lib/email');

function getBaseUrl(event) {
	try {
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
		const parsed = (() => {
			try {
				return event && event.body ? JSON.parse(event.body) : {};
			} catch {
				return {};
			}
		})();
		const { email, name } = validateAddContact(parsed);

		let created;
		try {
			created = await addContact(email, name);
		} catch (err) {
			const msg = String(err);
			if (msg.includes('Contact already exists') || err.code === 'ContactExists') {
				return http.conflict('Contact already exists');
			}
			throw err;
		}

		// Immediately send to the newly created contact
		const ayah = await getRandomAyah();
		const record = {
			id: randomUUID(),
			createdAt: new Date().toISOString(),
			...ayah
		};
		await putAyah(record);

		const baseUrl = getBaseUrl(event) || process.env.HTTP_API_URL || '';
		const ops = [];
		const doEmail = created.subscribed !== false && !!created.email;

		if (doEmail) {
			const unsubscribeUrl = baseUrl ? `${baseUrl}/unsubscribe?id=${encodeURIComponent(created.id)}` : '#';
			const { subject, html, text } = buildReflectionEmailContent(ayah, unsubscribeUrl, created.name, true);
			ops.push(
				sendEmail({
					to: created.email,
					subject,
					html,
					text,
					attachments: ayah.audioUrl
						? [{ filename: `surah-${ayah.surahNumber}-ayah-${ayah.ayahNumber}.mp3`, path: ayah.audioUrl }]
						: undefined
				})
			);
		}
		if (ops.length === 0) {
			return http.ok('Contact added; no eligible channels to send', { id: created.id });
		}
		const settled = await Promise.allSettled(ops);
		const ok = settled.every((r) => r.status === 'fulfilled');
		return ok
			? http.created('Contact added and message sent', { id: created.id })
			: http.ok('Contact added; some sends failed', {
					id: created.id,
					details: settled.map((r) => ({ ok: r.status === 'fulfilled', error: r.status === 'rejected' ? String(r.reason) : undefined }))
				});
	} catch (err) {
		if (err && err.code === 'BadRequest') {
			return http.badRequest(err.message);
		}
		console.error(err);
		return http.error('Internal error');
	}
};


