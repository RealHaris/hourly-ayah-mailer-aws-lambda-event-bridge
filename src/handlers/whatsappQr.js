'use strict';

const QRCode = require('qrcode');
const { getLatestQr } = require('../lib/whatsapp');
const http = require('../lib/http');

exports.handler = async () => {
  try {
    const qr = await getLatestQr();
    if (!qr) {
      return http.ok('QR not yet generated. Initialize WhatsApp client by triggering a send.', { qr: null });
    }
    const dataUrl = await QRCode.toDataURL(qr, { type: 'image/png', errorCorrectionLevel: 'M' });
    return http.ok('QR generated', { dataUrl });
  } catch (err) {
    console.error('[whatsappQr] error', err);
    return http.error('Internal error');
  }
};


