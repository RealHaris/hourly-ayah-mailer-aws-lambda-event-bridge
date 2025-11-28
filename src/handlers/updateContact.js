'use strict';

const { getContactById, getContactByEmail, getContactByPhone } = require('../lib/dynamo');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { validateUpdateContact } = require('../lib/validation');
const { requireAuth } = require('../lib/auth');
const http = require('../lib/http');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONTACTS_TABLE_NAME = process.env.CONTACTS_TABLE_NAME;

exports.handler = async (event) => {
  try {
    const gate = requireAuth(event);
    if (gate && typeof gate.statusCode === 'number') return gate;

    const parsed = (() => {
      try {
        return event && event.body ? JSON.parse(event.body) : {};
      } catch {
        return {};
      }
    })();
    const { id, email, name, phone, send_email, send_whatsapp } = validateUpdateContact(event?.pathParameters, parsed);
    if (!id) return http.badRequest('id is required');
    const existing = await getContactById(id);
    if (!existing) {
      return http.notFound('Contact not found');
    }
    const newEmail = email;
    const newPhone = phone || undefined;

    // Uniqueness checks when changing
    if (newEmail !== undefined && existing.email !== newEmail) {
      const byEmail = await getContactByEmail(newEmail);
      if (byEmail && byEmail.id !== id) {
        return http.conflict('Contact already exists (email)');
      }
    }
    if (newPhone !== undefined && newPhone !== '' && existing.phone !== newPhone) {
      const byPhone = await getContactByPhone(newPhone);
      if (byPhone && byPhone.id !== id) {
        return http.conflict('Contact already exists (phone)');
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
    if (newPhone !== undefined) setField('phone', newPhone);
    if (send_email !== undefined) setField('send_email', !!send_email);
    if (send_whatsapp !== undefined) setField('send_whatsapp', !!send_whatsapp);
    setField('updatedAt', new Date().toISOString());

    if (sets.length === 1) {
      // Only updatedAt would be set; nothing to update
      return http.ok('No changes', { id });
    }

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


