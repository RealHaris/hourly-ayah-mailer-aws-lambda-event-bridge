'use strict';

const { listContacts } = require('../lib/dynamo');
const { requireAuth } = require('../lib/auth');
const http = require('../lib/http');

exports.handler = async (event) => {
	try {
		const gate = requireAuth(event);
		if (gate && typeof gate.statusCode === 'number') return gate;

		const items = await listContacts();
		return http.ok('Contacts list', items);
	} catch (err) {
		console.error(err);
		return http.error('Internal error');
	}
};


