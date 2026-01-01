'use strict';

const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const client = new SecretsManagerClient({});

// Cache for app secrets to avoid repeated calls
let cachedAppSecrets = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Retrieves the app secrets from AWS Secrets Manager.
 * Returns an object with: QURAN_API_CLIENT_ID, QURAN_API_CLIENT_SECRET, JWT_ACCESS_SECRET, JWT_REFRESH_SECRET
 */
async function getAppSecrets() {
	const now = Date.now();
	if (cachedAppSecrets && now < cacheExpiry) {
		return cachedAppSecrets;
	}

	const secretId = process.env.APP_SECRETS_ID || 'ayah-mailer/config';
	if (!secretId) {
		// Fall back to inline environment variables for local/offline usage
		const fallback = {
			QURAN_API_CLIENT_ID: process.env.QURAN_API_CLIENT_ID,
			QURAN_API_CLIENT_SECRET: process.env.QURAN_API_CLIENT_SECRET,
			JWT_ACCESS_SECRET: process.env.JWT_ACCESS_SECRET,
			JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET
		};
		if (
			fallback.QURAN_API_CLIENT_ID &&
			fallback.QURAN_API_CLIENT_SECRET &&
			fallback.JWT_ACCESS_SECRET &&
			fallback.JWT_REFRESH_SECRET
		) {
			cachedAppSecrets = fallback;
			cacheExpiry = now + CACHE_TTL_MS;
			return cachedAppSecrets;
		}
		throw new Error('APP_SECRETS_ID environment variable not set and inline secrets are unavailable');
	}

	const command = new GetSecretValueCommand({ SecretId: secretId });
	const response = await client.send(command);

	if (!response.SecretString) {
		throw new Error('App secrets not found or empty');
	}

	const parsedResponse = JSON.parse(response.SecretString);

	// Extract secrets from the new structure
	cachedAppSecrets = {
		QURAN_API_CLIENT_ID: parsedResponse.quran_api?.client_id,
		QURAN_API_CLIENT_SECRET: parsedResponse.quran_api?.client_secret,
		JWT_ACCESS_SECRET: parsedResponse.jwt?.access_secret,
		JWT_REFRESH_SECRET: parsedResponse.jwt?.refresh_secret,
		RESEND_API_KEY: parsedResponse.resend?.api_key
	};

	cacheExpiry = now + CACHE_TTL_MS;

	return cachedAppSecrets;
}

/**
 * Get JWT Access Secret from Secrets Manager
 */
async function getJwtAccessSecret() {
	const secrets = await getAppSecrets();
	const secret = secrets.JWT_ACCESS_SECRET;
	if (!secret) {
		throw new Error('JWT_ACCESS_SECRET not found in app secrets');
	}
	return secret;
}

/**
 * Get JWT Refresh Secret from Secrets Manager
 */
async function getJwtRefreshSecret() {
	const secrets = await getAppSecrets();
	const secret = secrets.JWT_REFRESH_SECRET;
	if (!secret) {
		throw new Error('JWT_REFRESH_SECRET not found in app secrets');
	}
	return secret;
}

/**
 * Get Quran API credentials from Secrets Manager
 */
async function getQuranApiCredentials() {
	const secrets = await getAppSecrets();
	const clientId = secrets.QURAN_API_CLIENT_ID;
	const clientSecret = secrets.QURAN_API_CLIENT_SECRET;
	if (!clientId || !clientSecret) {
		throw new Error('QURAN_API_CLIENT_ID or QURAN_API_CLIENT_SECRET not found in app secrets');
	}
	return { clientId, clientSecret };
}

/**
 * Clear the secrets cache (useful for testing or forced refresh)
 */
function clearSecretsCache() {
	cachedAppSecrets = null;
	cacheExpiry = 0;
}

/**
 * Get Resend API Key from Secrets Manager
 */
async function getResendApiKey() {
	const secrets = await getAppSecrets();
	console.log(secrets);
	const apiKey = secrets.RESEND_API_KEY;
	if (!apiKey) {
		throw new Error('RESEND_API_KEY not found in app secrets');
	}
	return apiKey;
}

module.exports = {
	getAppSecrets,
	getJwtAccessSecret,
	getJwtRefreshSecret,
	getQuranApiCredentials,
	getResendApiKey,
	clearSecretsCache
};
