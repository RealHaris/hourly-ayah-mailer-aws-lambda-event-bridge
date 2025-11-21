'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah } = require('../lib/dynamo');
const { sendEmail } = require('../lib/email');

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

function parseBody(event) {
  try {
    return event && event.body ? JSON.parse(event.body) : {};
  } catch {
    return {};
  }
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

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

exports.handler = async (event) => {
  try {
    const { email } = parseBody(event);
    if (!email || !isValidEmail(email)) {
      return json(400, { ok: false, error: 'Valid email is required' });
    }

    const ayah = await getRandomAyah();
    const record = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...ayah
    };
    await putAyah(record);

    const { subject, html, text } = buildEmailContent(ayah);
    await sendEmail({ to: email, subject, html, text });
    return json(200, { ok: true, sent: 1 });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: String(err) });
  }
};



