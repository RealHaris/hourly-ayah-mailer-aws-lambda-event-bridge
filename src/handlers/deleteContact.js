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
		const id = event?.pathParameters?.id
			? decodeURIComponent(event.pathParameters.id)
			: null;
		if (!id) {
			return json(400, { ok: false, error: 'id path parameter is required' });
		}
		await deleteContact(id);
		return json(200, { ok: true, id });
	} catch (err) {
		console.error(err);
		return json(500, { ok: false, error: String(err) });
	}
};


