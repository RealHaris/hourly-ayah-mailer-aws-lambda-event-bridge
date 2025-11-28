'use strict';

const QRCode = require('qrcode');
const { getLatestQr } = require('../lib/whatsapp');

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

exports.handler = async () => {
  try {
    const qr = await getLatestQr();
    if (!qr) {
      return json(200, { ok: true, qr: null, message: 'QR not yet generated. Initialize WhatsApp client by triggering a send.' });
    }
    const dataUrl = await QRCode.toDataURL(qr, { type: 'image/png', errorCorrectionLevel: 'M' });
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': '*'
      },
      body: JSON.stringify({ ok: true, dataUrl })
    };
  } catch (err) {
    console.error('[whatsappQr] error', err);
    return json(500, { ok: false, error: String(err) });
  }
};


