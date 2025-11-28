'use strict';

const nodemailer = require('nodemailer');
const { SecretsManagerClient, GetSecretValueCommand } = require('@aws-sdk/client-secrets-manager');

const secretsClient = new SecretsManagerClient({});
let cachedSecret;
let cachedTransporter;

function escapeHtml(value) {
    return String(value || '').replace(/[<>&"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;' }[c]));
}

function buildReflectionEmailContent(ayah, unsubscribeUrl, recipientName, showUnsubscribe = true) {
    const unsub = typeof unsubscribeUrl === 'string' && unsubscribeUrl.trim().length > 0 ? unsubscribeUrl.trim() : '';
    const subject = `A Moment of Reflection - Surah ${ayah.surahNameEnglish} ${ayah.surahNumber}:${ayah.ayahNumber}`;
    const html = `<!DOCTYPE html>



<html lang="en">

<head>

    <meta charset="UTF-8">

    <meta name="viewport" content="width=device-width, initial-scale=1.0">

    <title>${subject}</title>

    

    <!-- Fonts -->

    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@100..900&display=swap" rel="stylesheet">

    <link href="https://fonts.googleapis.com/css2?family=Amiri+Quran&display=swap" rel="stylesheet">

    

    <style>

        /* Color Variables */

        :root {

            --color-bg-light: #F8F9FA;

            --color-white: #FFFFFF;

            --color-green-800: #166534; /* Darker Green for Header */

            --color-green-700: #15803d; 

            --color-green-50: #f0fdf4;  /* Lightest Green for Translation Box */

            --color-green-900: #052e16; /* Deep Green for Arabic Text */

            --color-green-300: #a7f3d0;

            --color-gray-100: #f3f4f6;

            --color-gray-400: #9ca3af;

            --color-gray-500: #6b7280;

            --color-gray-600: #4b5563;

            --color-gray-700: #374151;

        }

        /* Base Styles */

        body {

            font-family: 'Inter', sans-serif;

            background-color: var(--color-bg-light);

            display: flex;

            align-items: center;

            justify-content: center;

            min-height: 100vh;

            padding: 1.5rem; /* Equivalent to p-6 */

            margin: 0;

            -webkit-font-smoothing: antialiased;

            -moz-osx-font-smoothing: grayscale;

        }

        /* Main Container Styling (w-full max-w-3xl bg-white shadow-2xl rounded-xl) */

        .container {

            width: 100%;

            max-width: 48rem; /* Equivalent to max-w-3xl, slightly larger for better presentation */

            background-color: var(--color-white);

            box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04); /* shadow-2xl */

            border-radius: 0.75rem; /* rounded-xl */

            overflow: hidden;

        }

        /* Header Area (bg-green-800 p-6 sm:p-8 text-center) */

        .header {

            background-color: var(--color-green-800);

            padding: 1.5rem; /* p-6 */

            text-align: center;

            border-top-left-radius: 0.75rem;

            border-top-right-radius: 0.75rem;

        }

        .header h1 {

            font-size: 1.5rem; /* text-2xl */

            font-weight: 800; /* font-extrabold */

            color: var(--color-white);

            letter-spacing: 0.05em; /* tracking-wider */

        }

        /* Main Content Area (p-6 sm:p-10) */

        .content-main {

            padding: 2.5rem; /* p-10 default, adjust with media query for sm */

        }

        .content-main h2 {

            font-size: 1.25rem; /* text-xl */

            font-weight: 600; /* font-semibold */

            margin-bottom: 1rem; /* mb-4 */

            color: var(--color-green-700);

            border-bottom: 2px solid #d1fae5; /* border-b-2 border-green-100 */

            padding-bottom: 0.5rem; /* pb-2 */

        }

        /* Ayah in Arabic (arabic-text) */

        .arabic-text {

            font-family: 'Amiri Quran', serif;

            font-size: 2rem; 

            line-height: 2.5;

            direction: rtl; 

            text-align: right;

            color: var(--color-green-900);

            margin-bottom: 1.5rem; /* mb-6 */

            padding-left: 1rem; /* pl-4 */

        }

        /* English Translation Box */

        .translation-box {

            color: var(--color-gray-700);

            font-size: 1.125rem; /* text-lg */

            line-height: 1.625; /* leading-relaxed */

            margin-top: 2rem; /* mt-8 */

            background-color: var(--color-green-50);

            padding: 1rem; /* p-4 */

            border-radius: 0.5rem; /* rounded-lg */

            text-align: left;

        }

        .translation-box .label {

            font-weight: 500; /* font-medium */

            color: var(--color-green-800);

            margin-bottom: 0.5rem; /* mb-2 */

            display: block;

        }

        .translation-box .verse-text {

            font-weight: 400; /* font-normal */

            font-style: italic;

        }

        .translation-box .source {

            font-size: 0.875rem; /* text-sm */

            margin-top: 0.75rem; /* mt-3 */

            color: var(--color-gray-500);

        }

        /* Post-Ayah Separator */

        .separator-text {

            margin-top: 2rem; /* mt-8 */

            padding-top: 1.5rem; /* pt-6 */

            border-top: 1px solid var(--color-gray-100);

            text-align: center;

            color: var(--color-gray-500);

            font-size: 0.875rem; /* text-sm */

        }

        /* Footer Area (bg-gray-100 p-4 sm:p-6 text-center) */

        .footer {

            background-color: var(--color-gray-100);

            padding: 1.5rem; /* p-6 default */

            text-align: center;

            font-size: 0.875rem; /* text-sm */

            border-bottom-left-radius: 0.75rem;

            border-bottom-right-radius: 0.75rem;

        }

        .footer p {

            color: var(--color-gray-600);

        }

        .footer .copyright {

            margin-top: 1rem; /* mt-4 */

            font-size: 0.75rem; /* text-xs */

            color: var(--color-gray-400);

        }

        /* Unsubscribe Link Styling */

        .unsubscribe-link {

            display: block;

            margin-top: 0.5rem; /* mt-2 */

        }

        

        .unsubscribe-link a {

            color: var(--color-green-700);

            font-weight: 500; /* font-medium */

            text-decoration: underline;

            transition: color 150ms ease-in-out; /* transition duration-150 ease-in-out */

        }

        .unsubscribe-link a:hover {

            color: var(--color-green-900);

        }

        /* Responsive Adjustments (sm breakpoint) */

        @media (max-width: 640px) {

            body {

                padding: 1rem; /* p-4 */

            }

            .header {

                padding: 1.5rem; /* p-6 */

            }

            .content-main {

                padding: 1.5rem; /* p-6 */

            }

            .arabic-text {

                font-size: 1.75rem;

                line-height: 2;

            }

            .translation-box {

                font-size: 1rem;

            }

            .footer {

                padding: 1rem; /* p-4 */

            }

        }

    </style>

</head>

<body>

    <div class="container">

        

        <!-- Header / Banner Area -->

        <div class="header">

            <h1>

                A Moment of Reflection

            </h1>

        </div>

        <!-- Main Content: Ayah -->

        <div class="content-main">

            <h2>

                Holy Quran: A Reminder

            </h2>

            <!-- Ayah in Arabic -->

            <div class="arabic-text">

                <!-- Sūrat Al-Baqarah, Ayah 152: "So remember Me; I will remember you." -->

                ${ayah.textArabic}

            </div>

            <!-- English Translation -->

            <div class="translation-box">

                <span class="label">English Translation:</span>

                <p class="verse-text">

                    ${ayah.textEnglish}

                </p>

                <p class="source">

                    (Surah ${ayah.surahNameEnglish}, Ayah ${ayah.ayahNumber}) — ${ayah.surahNameEnglish} (${ayah.surahNumber}:${ayah.ayahNumber})

                </p>

            </div>

            ${ayah.textUrdu ? `
            <!-- Urdu Translation -->
            <div class="translation-box">
                <span class="label">Urdu Translation:</span>
                <p class="verse-text">
                    ${ayah.textUrdu}
                </p>
            </div>` : ``}

            ${ayah.tafseerText ? `
            <!-- Tafsir -->
            <div class="translation-box">
                <span class="label">Tafsir:</span>
                <p class="verse-text">
                    ${ayah.tafseerText}
                </p>
            </div>` : ``}

            ${ayah.audioUrl ? `
            <!-- Audio Link -->
            <div class="translation-box">
                <span class="label">Audio Recitation:</span>
                <p class="verse-text">
                    <a href="${ayah.audioUrl}" target="_blank" rel="noopener noreferrer">${ayah.audioUrl}</a>
                </p>
                <p class="source">An audio file is attached as well, if supported by your email client.</p>
            </div>` : ``}

            <div class="separator-text">

                May this verse bring peace to your heart.

            </div>

            ${recipientName ? `
            <div class="recipient-name" style="margin-top:0.5rem;text-align:center;color:#374151;font-size:0.875rem;">
                ${escapeHtml(recipientName)}
            </div>` : ``}

        </div>

        <!-- Footer / Unsubscribe Section -->

        <div class="footer">

            <p>

                You are receiving this inspirational message because you subscribed to our service.

            </p>

            ${showUnsubscribe && unsub ? `<div class="unsubscribe-link">
                <a href="${unsub}" target="_blank" rel="noopener noreferrer">Unsubscribe</a>
            </div>` : ``}

            <!-- Updated copyright/credit line -->

            <p class="copyright">

                Made by Haris with &#x1F49A;

            </p>

        </div>

    </div>

</body>

</html>
`;
    const text = [
        `A Moment of Reflection - Surah ${ayah.surahNameEnglish} ${ayah.surahNumber}:${ayah.ayahNumber}`,
        '',
        ayah.textArabic,
        '',
        ayah.textEnglish,
        '',
        `Surah ${ayah.surahNameEnglish} (${ayah.surahNumber}:${ayah.ayahNumber})`
    ].join('\n');
    return { subject, html, text };
}

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
    const cmd = new GetSecretValueCommand({ SecretId: secretId });
    const res = await secretsClient.send(cmd);
    if (!res || (!res.SecretString && !res.SecretBinary)) {
        throw new Error('Empty secret from Secrets Manager');
    }
    const payload = res.SecretString
        ? res.SecretString
        : Buffer.from(res.SecretBinary, 'base64').toString('utf-8');
    const creds = parseSecretPayloadToCreds(payload);
    if (!creds || !creds.username || !creds.app_password) {
        throw new Error(
            'Secret must contain username and app_password fields (JSON preferred: { "username": "...", "app_password": "..." })'
        );
    }
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
    return cachedTransporter;
}

async function sendEmail({ to, subject, html, text, attachments }) {
    const transporter = await getTransporter();
    const from = process.env.MAIL_FROM || (await getGmailCredentials()).username;
	return transporter.sendMail({
        from,
        to,
        subject,
        text,
		html,
		attachments: Array.isArray(attachments) ? attachments : undefined
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
    sendBulk,
    buildReflectionEmailContent
};


