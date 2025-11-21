'use strict';

const nodemailer = require('nodemailer');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({});
let cachedSecret;
let cachedTransporter;

async function getGmailCredentials() {
	if (cachedSecret) return cachedSecret;
	const secretId = process.env.GMAIL_SECRET_ID;
	if (!secretId) {
		throw new Error('GMAIL_SECRET_ID env var not set');
	}
	const cmd = new GetSecretValueCommand({ SecretId: secretId });
	const res = await secretsClient.send(cmd);
	if (!res || (!res.SecretString && !res.SecretBinary)) {
		throw new Error('Empty secret from Secrets Manager');
	}
	const payload = res.SecretString
		? res.SecretString
		: Buffer.from(res.SecretBinary, 'base64').toString('utf-8');
	const parsed = JSON.parse(payload);
	if (!parsed.username || !parsed.app_password) {
		throw new Error('Secret must contain username and app_password fields');
	}
	cachedSecret = parsed;
	return parsed;
}

async function getTransporter() {
	if (cachedTransporter) return cachedTransporter;
	const creds = await getGmailCredentials();
	cachedTransporter = nodemailer.createTransport({
		host: 'smtp.gmail.com',
		port: 465,
		secure: true,
		auth: {
			user: creds.username,
			pass: creds.app_password
		}
	});
	return cachedTransporter;
}

async function sendEmail({ to, subject, html, text }) {
	const transporter = await getTransporter();
	const from = process.env.MAIL_FROM || (await getGmailCredentials()).username;
	return transporter.sendMail({
		from,
		to,
		subject,
		text,
		html
	});
}

async function sendBulk(recipients, subject, html, text, batchSize = 5) {
	const results = [];
	for (let i = 0; i < recipients.length; i += batchSize) {
		const chunk = recipients.slice(i, i + batchSize);
		// fire in parallel in each batch
		// eslint-disable-next-line no-await-in-loop
		const settled = await Promise.allSettled(
			chunk.map((to) => sendEmail({ to, subject, html, text }))
		);
		for (let j = 0; j < settled.length; j += 1) {
			const to = chunk[j];
			const outcome = settled[j];
			results.push({
				to,
				ok: outcome.status === 'fulfilled',
				error: outcome.status === 'rejected' ? String(outcome.reason) : undefined
			});
		}
	}
	return results;
}

module.exports = {
	sendEmail,
	sendBulk
};


