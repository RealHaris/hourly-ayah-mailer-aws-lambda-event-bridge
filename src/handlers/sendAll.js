'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah, listContacts } = require('../lib/dynamo');
const { buildReflectionEmailContent, sendEmail } = require('../lib/email');
const { sendWhatsApp } = require('../lib/whatsapp');
const { requireAuth } = require('../lib/auth');
const http = require('../lib/http');

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

function buildWhatsAppText(ayah) {
	const lines = [];
	if (ayah.textArabic) lines.push(ayah.textArabic);
	if (ayah.textEnglish) lines.push('', ayah.textEnglish);
	if (ayah.textUrdu) lines.push('', ayah.textUrdu);
	if (ayah.tafseerText) lines.push('', `Tafsir:\n${ayah.tafseerText}`);
	lines.push(
		'',
		`Surah ${ayah.surahNameEnglish} (${ayah.surahNumber}:${ayah.ayahNumber})${ayah.audioUrl ? `\nAudio: ${ayah.audioUrl}` : ''}`
	);
	return lines.join('\n');
}

exports.handler = async (event) => {
	try {
		const gate = requireAuth(event);
		if (gate && typeof gate.statusCode === 'number') return gate;

		const ayah = await getRandomAyah();
		const record = {
			id: randomUUID(),
			createdAt: new Date().toISOString(),
			...ayah
		};
		await putAyah(record);

		const contacts = await listContacts();
		const valid = contacts.filter((c) => c && c.id && (c.email || c.phone));

		if (valid.length === 0) return http.ok('No contacts found; nothing to send.');

		const baseUrl = getBaseUrl(event) || process.env.HTTP_API_URL || '';
		const batchSize = 5;
		const results = [];
		for (let i = 0; i < valid.length; i += batchSize) {
			const chunk = valid.slice(i, i + batchSize);
			// eslint-disable-next-line no-await-in-loop
			const settled = await Promise.allSettled(
				chunk.map(async (c) => {
					const ops = [];
					const doEmail = c.send_email !== false && !!c.email;
					const doWa = c.send_whatsapp === true && !!c.phone;
					if (doEmail) {
						const unsubscribeUrl = baseUrl ? `${baseUrl}/unsubscribe?id=${encodeURIComponent(c.id)}` : '#';
						const { subject, html, text } = buildReflectionEmailContent(ayah, unsubscribeUrl, c.name, true);
						ops.push(
							sendEmail({
								to: c.email,
								subject,
								html,
								text,
								attachments: ayah.audioUrl
									? [{ filename: `surah-${ayah.surahNumber}-ayah-${ayah.ayahNumber}.mp3`, path: ayah.audioUrl }]
									: undefined
							})
						);
					}
					if (doWa) {
						const waText = buildWhatsAppText(ayah);
						const attachments = ayah.audioUrl ? [{ type: 'audio', url: ayah.audioUrl }] : undefined;
						ops.push(sendWhatsApp({ toE164: c.phone, text: waText, attachments }));
					}
					if (ops.length === 0) return null;
					const res = await Promise.allSettled(ops);
					return res.every((r) => r.status === 'fulfilled');
				})
			);
			for (let j = 0; j < settled.length; j += 1) {
				const contact = chunk[j];
				const outcome = settled[j];
				results.push({
					contactId: contact.id,
					ok: outcome.status === 'fulfilled' ? outcome.value === true : false,
					error: outcome.status === 'rejected' ? String(outcome.reason) : undefined
				});
			}
		}

		const ok = results.filter((r) => r.ok).length;
		const failed = results.length - ok;

		return http.ok('Bulk send completed', { sent: ok, failed, details: results });
	} catch (err) {
		console.error(err);
		return http.error('Internal error');
	}
};


