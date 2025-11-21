'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
	DynamoDBDocumentClient,
	PutCommand,
	ScanCommand,
	GetCommand,
	DeleteCommand
} = require('@aws-sdk/lib-dynamodb');

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

async function getContact(email) {
	const res = await ddb.send(
		new GetCommand({
			TableName: CONTACTS_TABLE_NAME,
			Key: { email }
		})
	);
	return res.Item || null;
}

async function addContact(email, name) {
	await ddb.send(
		new PutCommand({
			TableName: CONTACTS_TABLE_NAME,
			Item: {
				email,
				name,
				createdAt: new Date().toISOString()
			},
			ConditionExpression: 'attribute_not_exists(#e)',
			ExpressionAttributeNames: {
				'#e': 'email'
			}
		})
	);
	return { email, name };
}

async function deleteContact(email) {
	await ddb.send(
		new DeleteCommand({
			TableName: CONTACTS_TABLE_NAME,
			Key: { email }
		})
	);
	return { email };
}

module.exports = {
	putAyah,
	listContacts,
	getContact,
	addContact,
	deleteContact
};


