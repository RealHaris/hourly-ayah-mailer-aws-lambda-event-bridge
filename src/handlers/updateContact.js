'use strict';

const { getContactById, getContactByEmail, getContactByPhone } = require('../lib/dynamo');
const { DynamoDBClient } = require('@aws-sdk/client-dynamodb');
const { DynamoDBDocumentClient, UpdateCommand } = require('@aws-sdk/lib-dynamodb');
const { validateUpdateContact } = require('../lib/validation');

const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const CONTACTS_TABLE_NAME = process.env.CONTACTS_TABLE_NAME;

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

exports.handler = async (event) => {
  try {
    const parsed = (() => {
      try {
        return event && event.body ? JSON.parse(event.body) : {};
      } catch {
        return {};
      }
    })();
    const { id, email, name, phone, send_email, send_whatsapp } = validateUpdateContact(event?.pathParameters, parsed);
    if (!id) {
      return json(400, { ok: false, error: 'id is required' });
    }
    const existing = await getContactById(id);
    if (!existing) {
      return json(404, { ok: false, error: 'Contact not found' });
    }
    const newEmail = email;
    const newPhone = phone || undefined;

    // Uniqueness checks when changing
    if (newEmail !== undefined && existing.email !== newEmail) {
      const byEmail = await getContactByEmail(newEmail);
      if (byEmail && byEmail.id !== id) {
        return json(409, { ok: false, error: 'Contact already exists (email)' });
      }
    }
    if (newPhone !== undefined && newPhone !== '' && existing.phone !== newPhone) {
      const byPhone = await getContactByPhone(newPhone);
      if (byPhone && byPhone.id !== id) {
        return json(409, { ok: false, error: 'Contact already exists (phone)' });
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
      return json(200, { ok: true, id });
    }

    await ddb.send(new UpdateCommand({
      TableName: CONTACTS_TABLE_NAME,
      Key: { id },
      UpdateExpression: `SET ${sets.join(', ')}`,
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values
    }));

    return json(200, { ok: true, id });
  } catch (err) {
    if (err && err.code === 'BadRequest') {
      return json(400, { ok: false, error: err.message });
    }
    console.error(err);
    return json(500, { ok: false, error: String(err) });
  }
};


