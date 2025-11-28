'use strict';

const Joi = require('joi');
const http = require('../lib/http');
const { verifyRefreshToken, generateAccessToken, generateRefreshToken } = require('../lib/auth');
const { getUserById } = require('../lib/users');

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
			refreshToken: Joi.string().min(10).required()
		});
		const { value, error } = schema.validate(parsed, { abortEarly: false, stripUnknown: true });
		if (error) {
			return http.badRequest(error.details.map((d) => d.message).join('; '));
		}

		let claims;
		try {
			claims = verifyRefreshToken(value.refreshToken);
		} catch {
			return http.unauthorized('Invalid or expired refresh token');
		}

		// Optionally ensure user still exists
		const user = await getUserById(claims.sub);
		if (!user) return http.unauthorized('Invalid token');

		const accessToken = generateAccessToken(user);
		const refreshToken = generateRefreshToken(user); // rotate
		return http.ok('Token refreshed', { accessToken, refreshToken });
	} catch (err) {
		console.error(err);
		return http.error('Internal error');
	}
};


