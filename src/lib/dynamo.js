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
if (!CONTACTS_TABLE_NAME || !AYAHS_TABLE_NAME) {
	console.warn('Dynamo env vars not fully set: CONTACTS_TABLE_NAME and/or AYAHS_TABLE_NAME missing');
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
	if (!email) return null;
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

async function addContact(email, name) {
	if (!email) {
		const err = new Error('Email is required');
		err.code = 'BadRequest';
		throw err;
	}
	const existing = await getContactByEmail(email);
	if (existing) {
		await ddb.send(
			new UpdateCommand({
				TableName: CONTACTS_TABLE_NAME,
				Key: { id: existing.id },
				UpdateExpression: 'SET #name = :name, #subscribed = :subscribed, #updatedAt = :updatedAt',
				ExpressionAttributeNames: {
					'#name': 'name',
					'#subscribed': 'subscribed',
					'#updatedAt': 'updatedAt'
				},
				ExpressionAttributeValues: {
					':name': name,
					':subscribed': true,
					':updatedAt': new Date().toISOString()
				}
			})
		);
		return { ...existing, name, subscribed: true };
	}
	const id = randomUUID();
	const now = new Date().toISOString();
	await ddb.send(
		new PutCommand({
			TableName: CONTACTS_TABLE_NAME,
			Item: {
				id,
				email,
				name,
				createdAt: now,
				subscribed: true
			},
			ConditionExpression: 'attribute_not_exists(#id)',
			ExpressionAttributeNames: {
				'#id': 'id'
			}
		})
	);
	return { id, email, name, subscribed: true };
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

async function updateContactSubscription(id, subscribed) {
	await ddb.send(
		new UpdateCommand({
			TableName: CONTACTS_TABLE_NAME,
			Key: { id },
			UpdateExpression: 'SET #sub = :sub, #updatedAt = :updatedAt',
			ExpressionAttributeNames: {
				'#sub': 'subscribed',
				'#updatedAt': 'updatedAt'
			},
			ExpressionAttributeValues: {
				':sub': !!subscribed,
				':updatedAt': new Date().toISOString()
			}
		})
	);
	return { id, subscribed: !!subscribed };
}

module.exports = {
	putAyah,
	listContacts,
	getContactById,
	getContactByEmail,
	addContact,
	deleteContact,
	updateContactSubscription
};
