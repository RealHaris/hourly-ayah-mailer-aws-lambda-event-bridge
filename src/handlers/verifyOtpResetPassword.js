'use strict';

const Joi = require('joi');
const http = require('../lib/http');
const { getUserByEmail, setPassword } = require('../lib/users');

exports.handler = async (event) => {
  try {
    const parsed = (() => {
      try {
        return event && event.body ? JSON.parse(event.body) : {};
      } catch {
        return {};
      }
    })();

    const schema = Joi.object({
      email: Joi.string().email().trim().required(),
      otp: Joi.string().length(6).required(),
      newPassword: Joi.string().min(6).required()
    });
    const { value, error } = schema.validate(parsed, { abortEarly: false, stripUnknown: true });
    if (error) {
      return http.badRequest(error.details.map((d) => d.message).join('; '));
    }

    const user = await getUserByEmail(value.email);
    if (!user) return http.badRequest('Invalid or expired OTP');

    const now = Date.now();
    const expires = user.resetOtpExpiresAt ? Date.parse(user.resetOtpExpiresAt) : 0;
    if (!user.resetOtp || user.resetOtp !== value.otp || !expires || now > expires) {
      return http.badRequest('Invalid or expired OTP');
    }

    await setPassword(user.id, value.newPassword);
    return http.ok('Password reset successful');
  } catch (err) {
    console.error(err);
    return http.error('Internal error');
  }
};


