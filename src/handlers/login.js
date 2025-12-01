'use strict';

const Joi = require('joi');
const http = require('../lib/http');
const { getUserByEmail } = require('../lib/users');
const { verifyPassword, generateAccessToken, generateRefreshToken } = require('../lib/auth');

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
			password: Joi.string().min(6).required()
		});
		const { value, error } = schema.validate(parsed, { abortEarly: false, stripUnknown: true });
		if (error) {
			return http.badRequest(error.details.map((d) => d.message).join('; '));
		}

		const user = await getUserByEmail(value.email);
		if (!user) return http.unauthorized('Invalid credentials');

		const ok = await verifyPassword(value.password, user.password_salt, user.password_hash);
		if (!ok) return http.unauthorized('Invalid credentials');

		const accessToken = await generateAccessToken(user);
		const refreshToken = await generateRefreshToken(user);
		return http.ok('Logged in', { accessToken, refreshToken });
	} catch (err) {
		console.error(err);
		return http.error('Internal error');
	}
};


