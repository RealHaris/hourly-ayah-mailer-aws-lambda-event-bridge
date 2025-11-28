'use strict';

const Joi = require('joi');
const http = require('../lib/http');
const { createUser } = require('../lib/users');

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
			name: Joi.string().trim().min(1).required(),
			email: Joi.string().email().trim().required(),
			password: Joi.string().min(6).required()
		});
		const { value, error } = schema.validate(parsed, { abortEarly: false, stripUnknown: true });
		if (error) {
			return http.badRequest(error.details.map((d) => d.message).join('; '));
		}

		const created = await createUser(value);
		return http.created('User registered', { id: created.id, email: created.email, name: created.name });
	} catch (err) {
		const msg = String(err && err.message ? err.message : err);
		if (err && err.code === 'UserExists') {
			return http.conflict('User already exists');
		}
		if (err && err.code === 'BadRequest') {
			return http.badRequest(msg);
		}
		console.error(err);
		return http.error('Internal error');
	}
};


