'use strict';

const Joi = require('joi');

const emailSchema = Joi.string().email().trim();
const idSchema = Joi.string().trim().min(1).required();
// Phone must start with +92 and then digits
const phoneSchema = Joi.string()
  .trim()
  .pattern(/^\+92\d+$/)
  .message('phone must start with +92 and contain digits only');

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
    email: emailSchema,
    name: Joi.string().trim().required(),
    phone: phoneSchema.optional(),
    send_email: Joi.boolean().default(true),
    send_whatsapp: Joi.boolean().default(false)
  })
    .or('email', 'phone') // at least one of email or phone
    .custom((value, helpers) => {
      if (!value.send_email && !value.send_whatsapp) {
        return helpers.error('any.custom', { message: 'At least one of send_email or send_whatsapp must be true' });
      }
      return value;
    }, 'channel constraint');
  return validate(schema, body);
}

function validateUpdateContact(pathParams, body) {
  const merged = { id: pathParams?.id || body?.id, ...body };
  const schema = Joi.object({
    id: idSchema,
    email: Joi.string().email().trim(),
    name: Joi.string().trim(),
    phone: phoneSchema.allow(''),
    send_email: Joi.boolean(),
    send_whatsapp: Joi.boolean()
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

function validateSendDirectWhatsapp(body) {
  const schema = Joi.object({
    phone: phoneSchema.required()
  });
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
  validateSendDirectWhatsapp,
  validateDeleteContact,
  validateUnsubscribeQuery
};


