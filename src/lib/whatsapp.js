'use strict';

const chromium = require('@sparticuz/chromium');
const { Client, MessageMedia } = require('whatsapp-web.js');
const { getWhatsAppSession, putWhatsAppSession, getLatestQr, putLatestQr } = require('./dynamo');

let client;
let readyPromise;

async function buildPuppeteerConfig() {
	const executablePath = await chromium.executablePath();
	return {
		args: chromium.args,
		// Provide viewport defaults suitable for Lambda Chromium
		defaultViewport: chromium.defaultViewport,
		executablePath,
		headless: chromium.headless
	};
}

async function ensureClientReady() {
	if (client && client.pupPage) {
		return;
	}
	if (!readyPromise) {
		readyPromise = (async () => {
			const session = await getWhatsAppSession();
			const puppeteer = await buildPuppeteerConfig();
			client = new Client({
				puppeteer,
				// Use legacy session object persistence for Lambda friendliness
				session: session || undefined,
				qrMaxRetries: 1
			});

			client.on('qr', async (qr) => {
				// Store raw QR string; a separate endpoint can render PNG
				try {
					await putLatestQr(qr);
				} catch (e) {
					console.warn('[whatsapp] failed to store QR', e);
				}
			});

			client.on('authenticated', async (sess) => {
				try {
					await putWhatsAppSession(sess);
				} catch (e) {
					console.warn('[whatsapp] failed to persist session', e);
				}
			});

			await client.initialize();
		})();
	}
	await readyPromise;
}

async function getLatestQrString() {
	return getLatestQr();
}

async function sendWhatsApp({ toE164, text, attachments }) {
	await ensureClientReady();
	const chatId = `${toE164.replace(/[^\d]/g, '')}@c.us`;

	let result;
	if (attachments && attachments.length > 0) {
		// Attach the first media (audio prioritized)
		for (const att of attachments) {
			if (att.type === 'audio' && att.url) {
				// eslint-disable-next-line no-await-in-loop
				const media = await MessageMedia.fromUrl(att.url);
				// eslint-disable-next-line no-await-in-loop
				result = await client.sendMessage(chatId, media, { caption: text });
				return result;
			}
		}
		// Fallback: send first attachment as media
		const first = attachments[0];
		if (first && first.url) {
			const media = await MessageMedia.fromUrl(first.url);
			result = await client.sendMessage(chatId, media, { caption: text });
			return result;
		}
	}
	// Plain text if no attachment
	result = await client.sendMessage(chatId, text);
	return result;
}

module.exports = {
	ensureClientReady,
	getLatestQr: getLatestQrString,
	sendWhatsApp
};


