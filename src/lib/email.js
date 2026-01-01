'use strict';

const { getResendApiKey } = require('./secrets');

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
                <audio controls preload="none" style="width:100%;margin-top:0.5rem;">
                    <source src="${ayah.audioUrl}" type="audio/mpeg">
                    Your browser does not support the audio element.
                </audio>
                <p class="source">The full recitation is attached to this email.</p>
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
    const textParts = [
        `A Moment of Reflection - Surah ${ayah.surahNameEnglish} ${ayah.surahNumber}:${ayah.ayahNumber}`,
        '',
        ayah.textArabic,
        '',
        ayah.textEnglish,
        '',
        `Surah ${ayah.surahNameEnglish} (${ayah.surahNumber}:${ayah.ayahNumber})`
    ];
    if (ayah.tafseerText) {
        textParts.push('', 'Tafsir:', ayah.tafseerText);
    }
    if (ayah.audioUrl) {
        textParts.push('', 'Audio recitation attached.');
    }
    const text = textParts.join('\n');
    return { subject, html, text };
}


async function sendEmail({ to, subject, html, text, attachments }) {
    const apiKey = await getResendApiKey();
    const from = process.env.MAIL_FROM || 'hello@realharis.works';

    // Prepare email data
    const emailData = {
        from,
        to,
        subject,
        html,
        text
    };

    // Add attachments if provided
    if (attachments && Array.isArray(attachments) && attachments.length > 0) {
        // Resend expects attachments in a specific format
        const formattedAttachments = attachments.map(attachment => {
            if (attachment.path) {
                // If it's a path, we need to fetch the content
                return {
                    filename: attachment.filename,
                    path: attachment.path
                };
            } else {
                return attachment;
            }
        });
        emailData.attachments = formattedAttachments;
    }

    try {
        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
            },
            body: JSON.stringify(emailData)
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({}));
            throw new Error(`Resend API error: ${response.status} - ${error.message || 'Unknown error'}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error('Error sending email via Resend:', error);
        throw error;
    }
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


