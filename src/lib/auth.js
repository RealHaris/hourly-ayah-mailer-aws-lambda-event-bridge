'use strict';

const { randomBytes, scrypt } = require('crypto');
const { promisify } = require('util');
const jwt = require('jsonwebtoken');
const http = require('./http');

const scryptAsync = promisify(scrypt);
const KEYLEN = 64;

function getAccessSecret() {
	const secret = process.env.JWT_ACCESS_SECRET;
	if (!secret) throw new Error('JWT_ACCESS_SECRET not set');
	return secret;
}

function getRefreshSecret() {
	const secret = process.env.JWT_REFRESH_SECRET;
	if (!secret) throw new Error('JWT_REFRESH_SECRET not set');
	return secret;
}

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

function generateAccessToken(user) {
	const payload = { sub: user.id, email: user.email };
	return jwt.sign(payload, getAccessSecret(), { expiresIn: '2h' });
}

function generateRefreshToken(user) {
	const payload = { sub: user.id, email: user.email };
	return jwt.sign(payload, getRefreshSecret(), { expiresIn: '7d' });
}

function verifyAccessToken(token) {
	return jwt.verify(token, getAccessSecret());
}

function verifyRefreshToken(token) {
	return jwt.verify(token, getRefreshSecret());
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

function requireAuth(event) {
	try {
		const token = extractBearerToken(event);
		if (!token) return http.unauthorized('Missing bearer token');
		const claims = verifyAccessToken(token);
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


