'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah } = require('../lib/dynamo');
const { sendEmail, buildReflectionEmailContent } = require('../lib/email');

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
  return (recipientName) => {
    // Direct sends: no unsubscribe link or base URL
    return buildReflectionEmailContent(ayah, '', recipientName, false);
  };
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

    const render = buildEmailContent(ayah);
    const { subject, html, text } = render(undefined);
    await sendEmail({ to: email, subject, html, text });
    return json(200, { ok: true, sent: 1 });
  } catch (err) {
    console.error(err);
    return json(500, { ok: false, error: String(err) });
  }
};



