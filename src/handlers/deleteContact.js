'use strict';

const { deleteContact } = require('../lib/dynamo');

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
		const email = event?.pathParameters?.email
			? decodeURIComponent(event.pathParameters.email)
			: null;
		if (!email) {
			return json(400, { ok: false, error: 'email path parameter is required' });
		}
		await deleteContact(email);
		return json(200, { ok: true, email });
	} catch (err) {
		console.error(err);
		return json(500, { ok: false, error: String(err) });
	}
};


