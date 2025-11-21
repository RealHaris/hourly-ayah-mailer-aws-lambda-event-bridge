#!/usr/bin/env node
/**
 * Local test script for Lambda handlers
 * 
 * Usage:
 *   node test-local.js listContacts
 *   node test-local.js addContact
 *   node test-local.js sendAll
 */

// Set environment variables (adjust as needed)
process.env.CONTACTS_TABLE_NAME = process.env.CONTACTS_TABLE_NAME || 'Contacts';
process.env.AYAHS_TABLE_NAME = process.env.AYAHS_TABLE_NAME || 'Ayahs';
process.env.GMAIL_SECRET_ID = process.env.GMAIL_SECRET_ID || 'gmail/ayah-mailer';
process.env.MAIL_FROM = process.env.MAIL_FROM || 'harisxstudy@gmail.com';
process.env.EMAIL_SUBJECT = process.env.EMAIL_SUBJECT || 'Random Ayah';

const handlerName = process.argv[2];

if (!handlerName) {
  console.error('Usage: node test-local.js <handler-name>');
  console.error('\nAvailable handlers:');
  console.error('  - listContacts');
  console.error('  - addContact');
  console.error('  - deleteContact');
  console.error('  - sendContact');
  console.error('  - sendAll');
  console.error('  - scheduledSend');
  process.exit(1);
}

async function runTest() {
  let handler;
  let event = {};

  try {
    switch (handlerName) {
      case 'listContacts':
        handler = require('./src/handlers/listContacts');
        break;
      case 'addContact':
        handler = require('./src/handlers/addContact');
        event = {
          body: JSON.stringify({ email: 'test@example.com', name: 'Test User' })
        };
        break;
      case 'deleteContact':
        handler = require('./src/handlers/deleteContact');
        event = {
          pathParameters: { id: 'CONTACT_ID_HERE' }
        };
        break;
      case 'sendContact':
        handler = require('./src/handlers/sendContact');
        event = {
          body: JSON.stringify({ id: 'CONTACT_ID_HERE' })
        };
        break;
      case 'sendDirect':
        handler = require('./src/handlers/sendDirect');
        event = {
          body: JSON.stringify({ email: 'harisxstudy@gmail.com' })
        };
        break;
      case 'sendAll':
        handler = require('./src/handlers/sendAll');
        break;
      case 'scheduledSend':
        handler = require('./src/handlers/scheduledSend');
        break;
      default:
        console.error(`Unknown handler: ${handlerName}`);
        process.exit(1);
    }

    console.log(`Testing ${handlerName}...`);
    console.log('Environment:', {
      CONTACTS_TABLE_NAME: process.env.CONTACTS_TABLE_NAME,
      AYAHS_TABLE_NAME: process.env.AYAHS_TABLE_NAME,
      GMAIL_SECRET_ID: process.env.GMAIL_SECRET_ID,
      MAIL_FROM: process.env.MAIL_FROM,
      EMAIL_SUBJECT: process.env.EMAIL_SUBJECT
    });
    console.log('Event:', JSON.stringify(event, null, 2));
    console.log('\n--- Result ---\n');

    const result = await handler.handler(event);
    console.log(JSON.stringify(result, null, 2));
  } catch (err) {
    console.error('Error:', err);
    process.exit(1);
  }
}

runTest();

