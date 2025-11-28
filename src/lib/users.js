'use strict';

const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  QueryCommand,
  UpdateCommand
} = require('@aws-sdk/lib-dynamodb');
const { randomUUID } = require('crypto');
const { hashPassword } = require('./auth');

const USERS_TABLE_NAME = process.env.USERS_TABLE_NAME;
if (!USERS_TABLE_NAME) {
  console.warn('Dynamo env var not set: USERS_TABLE_NAME');
}

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function getUserById(id) {
  const res = await ddb.send(
    new GetCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id }
    })
  );
  return res.Item || null;
}

async function getUserByEmail(email) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) return null;
  const res = await ddb.send(
    new QueryCommand({
      TableName: USERS_TABLE_NAME,
      IndexName: 'EmailIndex',
      KeyConditionExpression: '#e = :e',
      ExpressionAttributeNames: { '#e': 'email' },
      ExpressionAttributeValues: { ':e': normalized },
      Limit: 1
    })
  );
  if (Array.isArray(res.Items) && res.Items.length > 0) {
    return res.Items[0];
  }
  return null;
}

async function createUser({ name, email, password }) {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    const err = new Error('email is required');
    err.code = 'BadRequest';
    throw err;
  }
  const exists = await getUserByEmail(normalized);
  if (exists) {
    const err = new Error('User already exists');
    err.code = 'UserExists';
    throw err;
  }
  const { saltHex, hashHex } = await hashPassword(password);
  const id = randomUUID();
  const now = new Date().toISOString();
  await ddb.send(
    new PutCommand({
      TableName: USERS_TABLE_NAME,
      Item: {
        id,
        email: normalized,
        name,
        password_salt: saltHex,
        password_hash: hashHex,
        createdAt: now,
        updatedAt: now
      },
      ConditionExpression: 'attribute_not_exists(#id)',
      ExpressionAttributeNames: {
        '#id': 'id'
      }
    })
  );
  return { id, email: normalized, name };
}

async function setPassword(userId, newPassword) {
  const { saltHex, hashHex } = await hashPassword(newPassword);
  await ddb.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: userId },
      UpdateExpression: 'SET #ps = :ps, #ph = :ph, #u = :u REMOVE #otp, #otpe',
      ExpressionAttributeNames: {
        '#ps': 'password_salt',
        '#ph': 'password_hash',
        '#u': 'updatedAt',
        '#otp': 'resetOtp',
        '#otpe': 'resetOtpExpiresAt'
      },
      ExpressionAttributeValues: {
        ':ps': saltHex,
        ':ph': hashHex,
        ':u': new Date().toISOString()
      }
    })
  );
  return true;
}

async function setResetOtp(email, otp, expiresAt) {
  const user = await getUserByEmail(email);
  if (!user) return false;
  await ddb.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: user.id },
      UpdateExpression: 'SET #otp = :otp, #otpe = :otpe, #u = :u',
      ExpressionAttributeNames: {
        '#otp': 'resetOtp',
        '#otpe': 'resetOtpExpiresAt',
        '#u': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':otp': otp,
        ':otpe': expiresAt,
        ':u': new Date().toISOString()
      }
    })
  );
  return true;
}

async function clearResetOtp(email) {
  const user = await getUserByEmail(email);
  if (!user) return false;
  await ddb.send(
    new UpdateCommand({
      TableName: USERS_TABLE_NAME,
      Key: { id: user.id },
      UpdateExpression: 'REMOVE #otp, #otpe SET #u = :u',
      ExpressionAttributeNames: {
        '#otp': 'resetOtp',
        '#otpe': 'resetOtpExpiresAt',
        '#u': 'updatedAt'
      },
      ExpressionAttributeValues: {
        ':u': new Date().toISOString()
      }
    })
  );
  return true;
}

module.exports = {
  getUserById,
  getUserByEmail,
  createUser,
  setPassword,
  setResetOtp,
  clearResetOtp
};


