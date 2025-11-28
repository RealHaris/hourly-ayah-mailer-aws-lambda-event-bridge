'use strict';

const fs = require('fs');
const path = require('path');

function loadEnvFor(functionKey) {
  try {
    const p = path.join(__dirname, 'env.json');
    const raw = fs.readFileSync(p, 'utf-8');
    const all = JSON.parse(raw);
    const env = all[functionKey] || {};
    for (const [k, v] of Object.entries(env)) {
      if (process.env[k] === undefined && v !== undefined) {
        process.env[k] = String(v);
      }
    }
  } catch {
    // ignore if env.json not found
  }
}

function parseBaseUrl(url) {
  try {
    if (!url) return null;
    const u = new URL(url);
    return {
      proto: u.protocol.replace(':', ''),
      host: u.host,
      stage: u.pathname.replace(/^\/+/, '').split('/')[0] || ''
    };
  } catch {
    return null;
  }
}

function buildEventBase() {
  const fromEnv = parseBaseUrl(process.env.TEST_BASE_URL || process.env.HTTP_API_URL);
  const localDefault = { proto: 'http', host: '127.0.0.1:3000', stage: '' };
  const b = fromEnv || localDefault;
  return {
    headers: {
      host: b.host,
      Host: b.host,
      'x-forwarded-proto': b.proto,
      'X-Forwarded-Proto': b.proto
    },
    requestContext: {
      stage: b.stage || ''
    }
  };
}

async function main() {
  const cmd = process.argv[2];
  if (!cmd) {
    console.error('Usage: node test-local.js <listContacts|addContact|deleteContact|sendContact|sendDirect|sendAll|scheduledSend|unsubscribe>');
    process.exit(1);
  }

  const map = {
    listContacts: { file: './src/handlers/listContacts', fnKey: 'ListContactsFunction' },
    addContact: { file: './src/handlers/addContact', fnKey: 'AddContactFunction' },
		updateContact: { file: './src/handlers/updateContact', fnKey: 'UpdateContactFunction' },
    deleteContact: { file: './src/handlers/deleteContact', fnKey: 'DeleteContactFunction' },
    sendContact: { file: './src/handlers/sendContact', fnKey: 'SendContactFunction' },
    sendDirect: { file: './src/handlers/sendDirect', fnKey: 'SendDirectFunction' },
		sendDirectWhatsapp: { file: './src/handlers/sendDirectWhatsapp', fnKey: 'SendDirectWhatsappFunction' },
		whatsappQr: { file: './src/handlers/whatsappQr', fnKey: 'WhatsAppQrFunction' },
    sendAll: { file: './src/handlers/sendAll', fnKey: 'SendAllFunction' },
    scheduledSend: { file: './src/handlers/scheduledSend', fnKey: 'ScheduledSendFunction' },
    unsubscribe: { file: './src/handlers/unsubscribe', fnKey: 'UnsubscribeFunction' }
  };
  const entry = map[cmd];
  if (!entry) {
    console.error('Unknown command:', cmd);
    process.exit(1);
  }

  loadEnvFor(entry.fnKey);
  const handler = require(entry.file);

  let event = buildEventBase();
  switch (cmd) {
    case 'addContact': {
			const email = process.env.TEST_EMAIL || 'test@example.com';
			const name = process.env.TEST_NAME || 'Test User';
			const phone = process.env.TEST_PHONE || '';
			const send_email = process.env.TEST_SEND_EMAIL !== 'false';
			const send_whatsapp = process.env.TEST_SEND_WHATSAPP === 'true';
			event = { ...event, body: JSON.stringify({ email, name, phone, send_email, send_whatsapp }) };
			break;
		}
		case 'updateContact': {
			const id = process.env.TEST_CONTACT_ID || 'CONTACT_ID_HERE';
			const email = process.env.TEST_EMAIL;
			const name = process.env.TEST_NAME;
			const phone = process.env.TEST_PHONE;
			const send_email = process.env.TEST_SEND_EMAIL;
			const send_whatsapp = process.env.TEST_SEND_WHATSAPP;
			const body = {};
			if (email !== undefined) body.email = email;
			if (name !== undefined) body.name = name;
			if (phone !== undefined) body.phone = phone;
			if (send_email !== undefined) body.send_email = send_email === 'true';
			if (send_whatsapp !== undefined) body.send_whatsapp = send_whatsapp === 'true';
			event = { ...event, pathParameters: { id }, body: JSON.stringify({ id, ...body }) };
      break;
    }
    case 'deleteContact': {
      const id = process.env.TEST_CONTACT_ID || 'CONTACT_ID_HERE';
      event = { ...event, pathParameters: { id } };
      break;
    }
    case 'sendContact': {
      const id = process.env.TEST_CONTACT_ID || 'CONTACT_ID_HERE';
      event = { ...event, body: JSON.stringify({ id }) };
      break;
    }
    case 'sendDirect': {
      const email = process.env.TEST_EMAIL || 'test@example.com';
      event = { ...event, body: JSON.stringify({ email }) };
      break;
    }
		case 'sendDirectWhatsapp': {
			const phone = process.env.TEST_PHONE || '+15551234567';
			event = { ...event, body: JSON.stringify({ phone }) };
			break;
		}
		case 'whatsappQr': {
			// no body needed
			break;
		}
    case 'unsubscribe': {
      const id = process.env.TEST_CONTACT_ID || 'CONTACT_ID_HERE';
      event = { ...event, queryStringParameters: { id } };
      break;
    }
    case 'sendAll':
    case 'listContacts':
    case 'scheduledSend': {
      // event base is enough
      break;
    }
    default:
      break;
  }

  try {
    const res = await handler.handler(event);
    console.log('Result:', typeof res === 'string' ? res : JSON.stringify(res, null, 2));
  } catch (err) {
    console.error('Handler error:', err);
    process.exit(2);
  }
}

main();


