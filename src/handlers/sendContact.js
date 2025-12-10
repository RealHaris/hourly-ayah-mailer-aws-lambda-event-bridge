'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah, getContactById } = require('../lib/dynamo');
const { sendEmail, buildReflectionEmailContent } = require('../lib/email');
const { validateSendContact } = require('../lib/validation');
const { requireAuth } = require('../lib/auth');
const http = require('../lib/http');

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
		const gate = await requireAuth(event);
		if (gate && typeof gate.statusCode === 'number') return gate;

		const parsed = (() => { try { return event && event.body ? JSON.parse(event.body) : {}; } catch { return {}; } })();
		const { id } = validateSendContact(parsed);
		if (!id) return http.badRequest('id is required');
		const contact = await getContactById(id);
		if (!contact) {
			return http.notFound('Contact not found');
		}
		const ayah = await getRandomAyah();
		const record = {
			id: randomUUID(),
			createdAt: new Date().toISOString(),
			...ayah
		};
		await putAyah(record);

		const baseUrl = getBaseUrl(event) || process.env.HTTP_API_URL || '';
		const ops = [];
		const doEmail = contact.subscribed !== false && !!contact.email;

		if (doEmail) {
			const unsubscribeUrl = baseUrl ? `${baseUrl}/unsubscribe?id=${encodeURIComponent(contact.id)}` : '#';
			const { subject, html, text } = buildReflectionEmailContent(ayah, unsubscribeUrl, contact.name, true);
			ops.push(
				sendEmail({
					to: contact.email,
					subject,
					html,
					text,
					attachments: ayah.audioUrl
						? [{ filename: `surah-${ayah.surahNumber}-ayah-${ayah.ayahNumber}.mp3`, path: ayah.audioUrl }]
						: undefined
				})
			);
		}
		if (ops.length === 0) return http.ok('No eligible channels for this contact', { sent: 0 });
		const settled = await Promise.allSettled(ops);
		const ok = settled.every((r) => r.status === 'fulfilled');
		return http.ok('Send completed', { sent: ok ? ops.length : 0 });
	} catch (err) {
		if (err && err.code === 'BadRequest') {
			return http.badRequest(err.message);
		}
		console.error(err);
		return http.error('Internal error');
	}
};


