'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah } = require('../lib/dynamo');
const { sendEmail, buildReflectionEmailContent } = require('../lib/email');
const { validateSendDirect } = require('../lib/validation');
const { requireAuth } = require('../lib/auth');
const http = require('../lib/http');

function buildEmailContent(ayah) {
  return (recipientName) => {
    // Direct sends: no unsubscribe link or base URL
    return buildReflectionEmailContent(ayah, '', recipientName, false);
  };
}

exports.handler = async (event) => {
  try {
    // const gate = await requireAuth(event);
    // if (gate && typeof gate.statusCode === 'number') return gate;

    const parsed = (() => { try { return event && event.body ? JSON.parse(event.body) : {}; } catch { return {}; } })();
    const { email } = validateSendDirect(parsed);

    const ayah = await getRandomAyah();
    try {
      console.log('[sendDirect] ayah payload:', JSON.stringify(ayah));
    } catch {
      // ignore
    }
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
    console.log('[sendDirect] attachments:', attachments);
    const emailResponse = await sendEmail({ to: email, subject, html, text, attachments });
    try {
      console.log('[sendDirect] sendEmail response:', JSON.stringify(emailResponse));
    } catch {
      console.log('[sendDirect] sendEmail response (non-serializable)', emailResponse);
    }
    return http.ok('Send completed', { sent: 1 });
  } catch (err) {
    if (err && err.code === 'BadRequest') {
      return http.badRequest(err.message);
    }
    console.error(err);
    return http.error('Internal error');
  }
};



