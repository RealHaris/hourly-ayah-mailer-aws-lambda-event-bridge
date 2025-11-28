'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
	DynamoDBDocumentClient,
	PutCommand,
	ScanCommand,
	GetCommand,
	DeleteCommand,
	QueryCommand,
	UpdateCommand
} = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');

const CONTACTS_TABLE_NAME = process.env.CONTACTS_TABLE_NAME;
const AYAHS_TABLE_NAME = process.env.AYAHS_TABLE_NAME;
const WHATSAPP_SESSION_TABLE_NAME = process.env.WHATSAPP_SESSION_TABLE_NAME;

if (!CONTACTS_TABLE_NAME || !AYAHS_TABLE_NAME) {
	console.warn('Dynamo env vars not fully set: CONTACTS_TABLE_NAME and/or AYAHS_TABLE_NAME missing');
}
if (!WHATSAPP_SESSION_TABLE_NAME) {
	console.warn('Dynamo env var not set: WHATSAPP_SESSION_TABLE_NAME (needed for WhatsApp session/QR)');
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function putAyah(record) {
	await ddb.send(
		new PutCommand({
			TableName: AYAHS_TABLE_NAME,
			Item: record
		})
	);
	return record;
}

async function listContacts() {
	const items = [];
	let lastKey;
	do {
		// eslint-disable-next-line no-await-in-loop
		const res = await ddb.send(
			new ScanCommand({
				TableName: CONTACTS_TABLE_NAME,
				ExclusiveStartKey: lastKey
			})
		);
		if (Array.isArray(res.Items)) {
			items.push(...res.Items);
		}
		lastKey = res.LastEvaluatedKey;
	} while (lastKey);
	return items;
}

async function getContactById(id) {
	const res = await ddb.send(
		new GetCommand({
			TableName: CONTACTS_TABLE_NAME,
			Key: { id }
		})
	);
	return res.Item || null;
}

async function getContactByEmail(email) {
	const res = await ddb.send(
		new QueryCommand({
			TableName: CONTACTS_TABLE_NAME,
			IndexName: 'EmailIndex',
			KeyConditionExpression: '#e = :e',
			ExpressionAttributeNames: { '#e': 'email' },
			ExpressionAttributeValues: { ':e': email },
			Limit: 1
		})
	);
	if (Array.isArray(res.Items) && res.Items.length > 0) {
		return res.Items[0];
	}
	return null;
}

async function getContactByPhone(phone) {
	if (!phone) return null;
	const res = await ddb.send(
		new QueryCommand({
			TableName: CONTACTS_TABLE_NAME,
			IndexName: 'PhoneIndex',
			KeyConditionExpression: '#p = :p',
			ExpressionAttributeNames: { '#p': 'phone' },
			ExpressionAttributeValues: { ':p': phone },
			Limit: 1
		})
	);
	if (Array.isArray(res.Items) && res.Items.length > 0) {
		return res.Items[0];
	}
	return null;
}

async function addContact(email, name, phone, sendEmail = true, sendWhatsApp = false) {
	// enforce unique email using GSI (only if provided)
	if (email) {
		const existing = await getContactByEmail(email);
		if (existing) {
			const err = new Error('Contact already exists');
			err.code = 'ContactExists';
			throw err;
		}
	}
	// enforce unique phone if provided
	if (phone) {
		const existingPhone = await getContactByPhone(phone);
		if (existingPhone) {
			const err = new Error('Contact already exists');
			err.code = 'ContactExists';
			throw err;
		}
	}
	const id = randomUUID();
	await ddb.send(
		new PutCommand({
			TableName: CONTACTS_TABLE_NAME,
			Item: {
				id,
				email: email || undefined,
				name,
				createdAt: new Date().toISOString(),
				phone: phone || undefined,
				send_email: !!sendEmail,
				send_whatsapp: !!sendWhatsApp
			},
			ConditionExpression: 'attribute_not_exists(#id)',
			ExpressionAttributeNames: {
				'#id': 'id'
			}
		})
	);
	return { id, email, name, phone, send_email: !!sendEmail, send_whatsapp: !!sendWhatsApp };
}

async function deleteContact(id) {
	await ddb.send(
		new DeleteCommand({
			TableName: CONTACTS_TABLE_NAME,
			Key: { id }
		})
	);
	return { id };
}

module.exports = {
	putAyah,
	listContacts,
	getContactById,
	getContactByEmail,
	getContactByPhone,
	addContact,
	deleteContact,
	getWhatsAppSession,
	putWhatsAppSession,
	getLatestQr,
	putLatestQr
};

// WhatsApp session helpers
async function getWhatsAppSession() {
	if (!WHATSAPP_SESSION_TABLE_NAME) return null;
	const res = await ddb.send(
		new GetCommand({
			TableName: WHATSAPP_SESSION_TABLE_NAME,
			Key: { id: 'session' }
		})
	);
	return (res.Item && res.Item.session) || null;
}

async function putWhatsAppSession(session) {
	if (!WHATSAPP_SESSION_TABLE_NAME) return;
	await ddb.send(
		new PutCommand({
			TableName: WHATSAPP_SESSION_TABLE_NAME,
			Item: { id: 'session', session, updatedAt: new Date().toISOString() }
		})
	);
}

async function getLatestQr() {
	if (!WHATSAPP_SESSION_TABLE_NAME) return null;
	const res = await ddb.send(
		new GetCommand({
			TableName: WHATSAPP_SESSION_TABLE_NAME,
			Key: { id: 'qr' }
		})
	);
	return (res.Item && res.Item.qr) || null;
}

async function putLatestQr(qr) {
	if (!WHATSAPP_SESSION_TABLE_NAME) return;
	await ddb.send(
		new PutCommand({
			TableName: WHATSAPP_SESSION_TABLE_NAME,
			Item: { id: 'qr', qr, updatedAt: new Date().toISOString() }
		})
	);
}


