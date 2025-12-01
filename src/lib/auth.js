'use strict';

const { randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const http = require('./http');
const { getJwtAccessSecret, getJwtRefreshSecret } = require('./secrets');

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

async function hashPassword(password) {
	const salt = randomBytes(16);
	const derived = await scryptAsync(password, salt, KEYLEN);
	return { saltHex: salt.toString('hex'), hashHex: Buffer.from(derived).toString('hex') };
}

async function verifyPassword(password, saltHex, hashHex) {
	if (!saltHex || !hashHex) return false;
	const salt = Buffer.from(saltHex, 'hex');
	const derived = await scryptAsync(password, salt, KEYLEN);
	return Buffer.compare(Buffer.from(hashHex, 'hex'), Buffer.from(derived)) === 0;
}

async function generateAccessToken(user) {
	const payload = { sub: user.id, email: user.email };
	const secret = await getJwtAccessSecret();
	return jwt.sign(payload, secret, { expiresIn: '2h' });
}

async function generateRefreshToken(user) {
	const payload = { sub: user.id, email: user.email };
	const secret = await getJwtRefreshSecret();
	return jwt.sign(payload, secret, { expiresIn: '7d' });
}

async function verifyAccessToken(token) {
	const secret = await getJwtAccessSecret();
	return jwt.verify(token, secret);
}

async function verifyRefreshToken(token) {
	const secret = await getJwtRefreshSecret();
	return jwt.verify(token, secret);
}

function extractBearerToken(event) {
	const headers = (event && event.headers) || {};
	const raw = headers.Authorization || headers.authorization || '';
	if (typeof raw !== 'string') return null;
	const parts = raw.split(' ');
	if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
		return parts[1].trim();
	}
	return null;
}

async function requireAuth(event) {
	try {
		const token = extractBearerToken(event);
		if (!token) return http.unauthorized('Missing bearer token');
		const claims = await verifyAccessToken(token);
		return { user: { id: claims.sub, email: claims.email }, claims };
	} catch (err) {
		return http.unauthorized('Invalid or expired token');
	}
}

function generateOtp() {
	// 6-digit numeric OTP
	const n = Math.floor(Math.random() * 1000000);
	return String(n).padStart(6, '0');
}

module.exports = {
	hashPassword,
	verifyPassword,
	generateAccessToken,
	generateRefreshToken,
	verifyAccessToken,
	verifyRefreshToken,
	requireAuth,
	generateOtp
};
