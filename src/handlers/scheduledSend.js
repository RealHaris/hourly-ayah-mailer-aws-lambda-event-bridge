'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah, listContacts } = require('../lib/dynamo');
const { sendBulk } = require('../lib/email');

function buildEmailContent(ayah) {
	const subjectBase = process.env.EMAIL_SUBJECT || 'Random Ayah';
	const subject = `${subjectBase} - ${ayah.surahNameEnglish} (${ayah.surahNumber}:${ayah.ayahNumber})`;
	const html = `
<div style="font-family: system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Helvetica Neue, Arial, sans-serif;">
  <div dir="rtl" style="font-size:20px;line-height:1.8;">${ayah.textArabic}</div>
  <div style="margin-top:12px;font-size:16px;line-height:1.6;">${ayah.textEnglish}</div>
  <div style="margin-top:12px;color:#666;">${ayah.surahNameEnglish} (${ayah.surahNumber}:${ayah.ayahNumber})</div>
</div>`.trim();
	const text = `${ayah.textArabic}\n\n${ayah.textEnglish}\n\n${ayah.surahNameEnglish} (${ayah.surahNumber}:${ayah.ayahNumber})`;
	return { subject, html, text };
}

exports.handler = async () => {
	const ayah = await getRandomAyah();
	const record = {
		id: randomUUID(),
		createdAt: new Date().toISOString(),
		...ayah
	};
	await putAyah(record);

	const contacts = await listContacts();
	const recipients = contacts.map((c) => c.email).filter(Boolean);

	if (recipients.length === 0) {
		console.log('No contacts found; nothing to send.');
		return { ok: true, sent: 0 };
	}

	const { subject, html, text } = buildEmailContent(ayah);
	const results = await sendBulk(recipients, subject, html, text, 5);
	const ok = results.filter((r) => r.ok).length;
	const failed = results.length - ok;

	console.log(`Scheduled send complete: success=${ok}, failed=${failed}`);
	if (failed > 0) {
		console.log('Failures:', results.filter((r) => !r.ok));
	}
	return { ok: true, sent: ok, failed };
};


