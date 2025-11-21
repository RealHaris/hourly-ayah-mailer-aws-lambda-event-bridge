'use strict';

const nodemailer = require('nodemailer');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({});
let cachedSecret;
let cachedTransporter;

function tryParseJsonSafely(text) {
	if (typeof text !== 'string') return null;
	const trimmed = text.trim();
	if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) {
		return null;
	}
	try {
		return JSON.parse(trimmed);
	} catch {
		return null;
	}
}

function parseSecretPayloadToCreds(raw) {
	// Prefer strict JSON
	const asJson = tryParseJsonSafely(raw);
	if (asJson && typeof asJson === 'object') {
		const username = asJson.username;
		const appPassword = asJson.app_password;
		if (username && appPassword) {
			return { username, app_password: appPassword };
		}
	}

	// Single-line object-ish string: {key:value,key2:value2}
	if (typeof raw === 'string') {
		let s = raw.trim();
		if (s.startsWith('{') && s.endsWith('}')) {
			s = s.slice(1, -1);
			const kv = {};
			for (const part of s.split(',')) {
				const idx = part.indexOf(':');
				if (idx > -1) {
					const key = part.slice(0, idx).trim();
					const value = part.slice(idx + 1).trim();
					if (key) kv[key] = value;
				}
			}
			const username = kv.username;
			const appPassword = kv.app_password;
			if (username && appPassword) {
				return { username, app_password: appPassword };
			}
		}
	}

	// key=value or key: value format
	const lines = String(raw).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
	if (lines.length >= 1) {
		const kv = {};
		for (const line of lines) {
			const m = line.match(/^([^:=\s]+)\s*[:=]\s*(.+)$/);
			if (m) kv[m[1]] = m[2];
		}
		const username = kv.username;
		const appPassword = kv.app_password;
		if (username && appPassword) {
			return { username, app_password: appPassword };
		}
	}

	// single line user:pass
	if (typeof raw === 'string' && raw.includes(':')) {
		const idx = raw.indexOf(':');
		const u = raw.slice(0, idx).trim();
		const p = raw.slice(idx + 1).trim();
		if (u && p) return { username: u, app_password: p };
	}

	return null;
}

async function getGmailCredentials() {
	if (cachedSecret) return cachedSecret;
	const secretId = process.env.GMAIL_SECRET_ID;
	if (!secretId) {
		throw new Error('GMAIL_SECRET_ID env var not set');
	}
	console.log('[secrets] Reading secret from Secrets Manager', { secretId });
	const cmd = new GetSecretValueCommand({ SecretId: secretId });
	const res = await secretsClient.send(cmd);
	if (!res || (!res.SecretString && !res.SecretBinary)) {
		throw new Error('Empty secret from Secrets Manager');
	}
	const payload = res.SecretString
		? res.SecretString
		: Buffer.from(res.SecretBinary, 'base64').toString('utf-8');
	// avoid logging secret content, log metadata only
	console.log('[secrets] Parsing secret payload', { length: typeof payload === 'string' ? payload.length : 0 });
	const creds = parseSecretPayloadToCreds(payload);
	if (!creds || !creds.username || !creds.app_password) {
		throw new Error(
			'Secret must contain username and app_password fields (JSON preferred: { "username": "...", "app_password": "..." })'
		);
	}
	// mask username to avoid leaking full email in logs
	const usernameMasked =
		typeof creds.username === 'string' && creds.username.includes('@')
			? `${creds.username.slice(0, 2)}***@${creds.username.split('@')[1]}`
			: '***';
	console.log('[secrets] Parsed secret fields', {
		usernameMasked,
		appPasswordLength: typeof creds.app_password === 'string' ? creds.app_password.length : undefined
	});
	cachedSecret = creds;
	return creds;
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
	console.log('[email] SMTP transporter created (gmail smtp over 465)');
	return cachedTransporter;
}

async function sendEmail({ to, subject, html, text }) {
	const transporter = await getTransporter();
	const from = process.env.MAIL_FROM || (await getGmailCredentials()).username;
	console.log('[email] Sending email', {
		from,
		to,
		subjectLength: typeof subject === 'string' ? subject.length : undefined,
		htmlLength: typeof html === 'string' ? html.length : undefined,
		textLength: typeof text === 'string' ? text.length : undefined
	});
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


