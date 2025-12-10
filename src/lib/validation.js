'use strict';

const Joi = require('joi');

const emailSchema = Joi.string().email().trim();
const idSchema = Joi.string().trim().min(1).required();
function validate(schema, payload) {
  const { value, error } = schema.validate(payload, {
    abortEarly: false,
    stripUnknown: true,
    convert: true
  });
  if (error) {
    const msg = error.details.map((d) => d.message).join('; ');
    const err = new Error(msg);
    err.code = 'BadRequest';
    throw err;
  }
  return value;
}

function validateAddContact(body) {
  const schema = Joi.object({
    email: emailSchema.required(),
    name: Joi.string().trim().required()
  });
  return validate(schema, body);
}

function validateUpdateContact(pathParams, body) {
  const merged = { id: pathParams?.id || body?.id, ...body };
  const schema = Joi.object({
    id: idSchema,
    email: Joi.string().email().trim(),
    name: Joi.string().trim(),
    subscribed: Joi.boolean()
  });
  return validate(schema, merged);
}

function validateSendContact(body) {
  const schema = Joi.object({ id: idSchema });
  return validate(schema, body);
}

function validateSendDirect(body) {
  const schema = Joi.object({ email: emailSchema });
  return validate(schema, body);
}

function validateDeleteContact(pathParams) {
  const schema = Joi.object({ id: idSchema });
  return validate(schema, pathParams || {});
}

function validateUnsubscribeQuery(qs) {
  const schema = Joi.object({ id: idSchema });
  return validate(schema, qs || {});
}

module.exports = {
  validateAddContact,
  validateUpdateContact,
  validateSendContact,
  validateSendDirect,
  validateDeleteContact,
  validateUnsubscribeQuery
};


