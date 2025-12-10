'use strict';

const { getContactById, getContactByEmail } = require('../lib/dynamo');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { validateUpdateContact } = require('../lib/validation');
const { requireAuth } = require('../lib/auth');
const http = require('../lib/http');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONTACTS_TABLE_NAME = process.env.CONTACTS_TABLE_NAME;

exports.handler = async (event) => {
  try {
    const gate = await requireAuth(event);
    if (gate && typeof gate.statusCode === 'number') return gate;

    const parsed = (() => {
      try {
        return event && event.body ? JSON.parse(event.body) : {};
      } catch {
        return {};
      }
    })();
    const { id, email, name, subscribed } = validateUpdateContact(event?.pathParameters, parsed);
    if (!id) return http.badRequest('id is required');
    const existing = await getContactById(id);
    if (!existing) {
      return http.notFound('Contact not found');
    }
    const newEmail = email;

    // Uniqueness checks when changing
    if (newEmail !== undefined && existing.email !== newEmail) {
      const byEmail = await getContactByEmail(newEmail);
      if (byEmail && byEmail.id !== id) {
        return http.conflict('Contact already exists (email)');
      }
    }

    // Build update expression
    const sets = [];
    const names = {};
    const values = {};
    function setField(attr, value) {
      const n = `#${attr}`;
      const v = `:${attr}`;
      names[n] = attr;
      values[v] = value;
      sets.push(`${n} = ${v}`);
    }
    if (name !== undefined) setField('name', name);
    if (newEmail !== undefined) setField('email', newEmail);
    if (email === undefined && name === undefined && subscribed === undefined) {
      return http.ok('No changes', { id });
    }
    if (subscribed !== undefined) setField('subscribed', !!subscribed);
    setField('updatedAt', new Date().toISOString());

    await ddb.send(new UpdateCommand({
      TableName: CONTACTS_TABLE_NAME,
      Key: { id },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    }));

    return http.ok('Contact updated', { id });
  } catch (err) {
    if (err && err.code === 'BadRequest') {
      return http.badRequest(err.message);
    }
    console.error(err);
    return http.error('Internal error');
  }
};


