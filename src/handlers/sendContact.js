'use strict';

const { randomUUID } = require('crypto');
const { getRandomAyah } = require('../lib/quran');
const { putAyah, getContactById } = require('../lib/dynamo');
const { sendEmail, buildReflectionEmailContent } = require('../lib/email');

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

exports.handler = async (event) => {
	try {
		const { id } = parseBody(event);
		if (!id) {
			return json(400, { ok: false, error: 'id is required' });
		}
		const contact = await getContactById(id);
		if (!contact) {
			return json(404, { ok: false, error: 'Contact not found' });
		}
		const email = contact.email;
		const ayah = await getRandomAyah();
		const record = {
			id: randomUUID(),
			createdAt: new Date().toISOString(),
			...ayah
		};
		await putAyah(record);

		const baseUrl = process.env.HTTP_API_URL || '';
		const unsubscribeUrl = baseUrl ? `${baseUrl}/unsubscribe?id=${encodeURIComponent(contact.id)}` : '#';
		const { subject, html, text } = buildReflectionEmailContent(ayah, unsubscribeUrl, contact.name);
		await sendEmail({ to: email, subject, html, text });
		return json(200, { ok: true, sent: 1 });
	} catch (err) {
		console.error(err);
		return json(500, { ok: false, error: String(err) });
	}
};


