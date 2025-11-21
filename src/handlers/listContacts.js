'use strict';

const { listContacts } = require('../lib/dynamo');

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

exports.handler = async () => {
	try {
		const items = await listContacts();
		return json(200, { ok: true, items });
	} catch (err) {
		console.error(err);
		return json(500, { ok: false, error: String(err) });
	}
};


