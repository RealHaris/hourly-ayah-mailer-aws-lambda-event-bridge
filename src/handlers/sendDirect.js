'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah } = require('../lib/dynamo');
const { sendEmail, buildReflectionEmailContent } = require('../lib/email');
const { validateSendDirect } = require('../lib/validation');

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

function buildEmailContent(ayah) {
  return (recipientName) => {
    // Direct sends: no unsubscribe link or base URL
    return buildReflectionEmailContent(ayah, '', recipientName, false);
  };
}

exports.handler = async (event) => {
  try {
    const parsed = (() => { try { return event && event.body ? JSON.parse(event.body) : {}; } catch { return {}; } })();
    const { email } = validateSendDirect(parsed);

    const ayah = await getRandomAyah();
    const record = {
      id: randomUUID(),
      createdAt: new Date().toISOString(),
      ...ayah
    };
    await putAyah(record);

    const render = buildEmailContent(ayah);
    const { subject, html, text } = render(undefined);
    const attachments = ayah.audioUrl
      ? [{ filename: `surah-${ayah.surahNumber}-ayah-${ayah.ayahNumber}.mp3`, path: ayah.audioUrl }]
      : undefined;
    await sendEmail({ to: email, subject, html, text, attachments });
    return json(200, { ok: true, sent: 1 });
  } catch (err) {
    if (err && err.code === 'BadRequest') {
      return json(400, { ok: false, error: err.message });
    }
    console.error(err);
    return json(500, { ok: false, error: String(err) });
  }
};



