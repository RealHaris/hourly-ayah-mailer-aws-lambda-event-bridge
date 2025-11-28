'use strict';

const { deleteContact } = require('../lib/dynamo');
const { validateDeleteContact } = require('../lib/validation');

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
		const { id } = validateDeleteContact(event?.pathParameters || {});
		await deleteContact(id);
		return json(200, { ok: true, id });
	} catch (err) {
		if (err && err.code === 'BadRequest') {
			return json(400, { ok: false, error: err.message });
		}
		console.error(err);
		return json(500, { ok: false, error: String(err) });
	}
};


