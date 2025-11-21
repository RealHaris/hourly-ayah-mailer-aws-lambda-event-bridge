'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah, listContacts } = require('../lib/dynamo');
const { sendEmail, buildReflectionEmailContent } = require('../lib/email');

exports.handler = async () => {
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
		console.log('No contacts found; nothing to send.');
		return { ok: true, sent: 0 };
	}

	const baseUrl = process.env.HTTP_API_URL || '';
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

	console.log(`Scheduled send complete: success=${ok}, failed=${failed}`);
	if (failed > 0) {
		console.log('Failures:', results.filter((r) => !r.ok));
	}
	return { ok: true, sent: ok, failed };
};


