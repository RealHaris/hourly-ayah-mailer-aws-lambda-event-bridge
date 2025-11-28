'use strict';

const Joi = require('joi');
const http = require('../lib/http');
const { sendEmail } = require('../lib/email');
const { setResetOtp, getUserByEmail } = require('../lib/users');
const { generateOtp } = require('../lib/auth');

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
			email: Joi.string().email().trim().required()
		});
		const { value, error } = schema.validate(parsed, { abortEarly: false, stripUnknown: true });
		if (error) {
			return http.badRequest(error.details.map((d) => d.message).join('; '));
		}

		const user = await getUserByEmail(value.email);
		// Always respond 200 to avoid user enumeration timing differences
		if (!user) {
			return http.ok('If an account exists, an OTP has been sent');
		}

		const otp = generateOtp();
		const ttlMin = Number(process.env.OTP_TTL_MINUTES || '10');
		const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000).toISOString();
		await setResetOtp(user.email, otp, expiresAt);

		const subject = 'Your password reset OTP';
		const text = `Your OTP is: ${otp}. It expires in ${ttlMin} minutes.`;
		const html = `<p>Your OTP is: <strong>${otp}</strong></p><p>It expires in ${ttlMin} minutes.</p>`;
		await sendEmail({ to: user.email, subject, text, html });

		return http.ok('If an account exists, an OTP has been sent');
	} catch (err) {
		console.error(err);
		return http.error('Internal error');
	}
};


