'use strict';

const { addContact } = require('../lib/dynamo');
const { validateAddContact } = require('../lib/validation');
const { requireAuth } = require('../lib/auth');
const http = require('../lib/http');

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
		const { email, name, phone, send_email, send_whatsapp } = validateAddContact(parsed);
		const created = await addContact(
			email,
			name,
			phone,
			send_email,
			send_whatsapp
		);
		return http.created('Contact created', created);
	} catch (err) {
		const msg = String(err);
		if (msg.includes('Contact already exists') || msg.includes('ConditionalCheckFailedException')) {
			return http.conflict('Contact already exists');
		}
		if (err && err.code === 'BadRequest') {
			return http.badRequest(err.message);
		}
		console.error(err);
		return http.error('Internal error');
	}
};


