'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah } = require('../lib/dynamo');
const { sendWhatsApp } = require('../lib/whatsapp');
const { validateSendDirectWhatsapp } = require('../lib/validation');
const { requireAuth } = require('../lib/auth');
const http = require('../lib/http');

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
    const gate = requireAuth(event);
    if (gate && typeof gate.statusCode === 'number') return gate;

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
    return http.ok('Send completed', { sent: 1 });
  } catch (err) {
    if (err && err.code === 'BadRequest') {
      return http.badRequest(err.message);
    }
    console.error(err);
    return http.error('Internal error');
  }
};


