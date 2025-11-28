'use strict';

const { addContact } = require('../lib/dynamo');
const { validateAddContact } = require('../lib/validation');

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
		const { email, name, phone, send_email, send_whatsapp } = validateAddContact(parsed);
		const created = await addContact(
			email,
			name,
			phone,
			send_email,
			send_whatsapp
		);
		return json(201, { ok: true, ...created });
	} catch (err) {
		const msg = String(err);
		if (msg.includes('Contact already exists') || msg.includes('ConditionalCheckFailedException')) {
			return json(409, { ok: false, error: 'Contact already exists' });
		}
		if (err && err.code === 'BadRequest') {
			return json(400, { ok: false, error: err.message });
		}
		console.error(err);
		return json(500, { ok: false, error: String(err) });
	}
};


