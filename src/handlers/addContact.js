'use strict';

const { addContact } = require('../lib/dynamo');

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

function parseBody(event) {
	try {
		return event && event.body ? JSON.parse(event.body) : {};
	} catch {
		return {};
	}
}

function isValidEmail(email) {
	return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

exports.handler = async (event) => {
	try {
		const { email, name } = parseBody(event);
		if (!email || !isValidEmail(email)) {
			return json(400, { ok: false, error: 'Valid email is required' });
		}
		await addContact(email, name);
		return json(201, { ok: true, email, name });
	} catch (err) {
		if (String(err).includes('ConditionalCheckFailedException')) {
			return json(409, { ok: false, error: 'Contact already exists' });
		}
		console.error(err);
		return json(500, { ok: false, error: String(err) });
	}
};


