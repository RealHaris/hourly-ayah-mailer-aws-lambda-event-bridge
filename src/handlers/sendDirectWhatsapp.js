'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah } = require('../lib/dynamo');
const { sendWhatsApp } = require('../lib/whatsapp');
const { validateSendDirectWhatsapp } = require('../lib/validation');

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

function buildWhatsAppText(ayah) {
  const parts = [];
  if (ayah.textArabic) parts.push(ayah.textArabic);
  if (ayah.textEnglish) parts.push('', ayah.textEnglish);
  if (ayah.textUrdu) parts.push('', ayah.textUrdu);
  if (ayah.tafseerText) parts.push('', `Tafsir:\n${ayah.tafseerText}`);
  parts.push(
    '',
    `Surah ${ayah.surahNameEnglish} (${ayah.surahNumber}:${ayah.ayahNumber})${ayah.audioUrl ? `\nAudio: ${ayah.audioUrl}` : ''}`
  );
  return parts.join('\n');
}

exports.handler = async (event) => {
  try {
    const parsed = (() => {
      try { return event && event.body ? JSON.parse(event.body) : {}; } catch { return {}; }
    })();
    const { phone } = validateSendDirectWhatsapp(parsed);
    const normalized = phone;

    const ayah = await getRandomAyah();
    const record = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...ayah
    };
    await putAyah(record);

    const text = buildWhatsAppText(ayah);
    const attachments = ayah.audioUrl ? [{ type: 'audio', url: ayah.audioUrl }] : undefined;
    await sendWhatsApp({ toE164: normalized, text, attachments });
    return json(200, { ok: true, sent: 1 });
  } catch (err) {
    if (err && err.code === 'BadRequest') {
      return json(400, { ok: false, error: err.message });
    }
    console.error(err);
    return json(500, { ok: false, error: String(err) });
  }
};


