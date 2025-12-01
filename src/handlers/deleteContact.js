'use strict';

const { deleteContact } = require('../lib/dynamo');
const { validateDeleteContact } = require('../lib/validation');
const { requireAuth } = require('../lib/auth');
const http = require('../lib/http');

exports.handler = async (event) => {
	try {
		const gate = await requireAuth(event);
		if (gate && typeof gate.statusCode === 'number') return gate;

		const { id } = validateDeleteContact(event?.pathParameters || {});
		await deleteContact(id);
		return http.ok('Contact deleted', { id });
	} catch (err) {
		if (err && err.code === 'BadRequest') {
			return http.badRequest(err.message);
		}
		console.error(err);
		return http.error('Internal error');
	}
};


