'use strict';

const { getQuranApiCredentials } = require('./secrets');

const fetch =
	typeof globalThis.fetch === 'function'
		? (...args) => globalThis.fetch(...args)
		: (...args) => import('node-fetch').then(({ default: nodeFetch }) => nodeFetch(...args));

let QuranClient;
let Language;

async function getSdk() {
	try {
		if (!QuranClient || !Language) {
			// eslint-disable-next-line global-require
			const sdk = require('@quranjs/api');
			QuranClient = sdk.QuranClient;
			Language = sdk.Language || { ENGLISH: 'en', ARABIC: 'ar', URDU: 'ur' };
		}
		return { QuranClient, Language };
	} catch (e) {
		throw new Error('Missing @quranjs/api dependency. Please ensure it is installed.');
	}
}

let cachedClient;
async function getClient() {
	if (cachedClient) return cachedClient;
	const { QuranClient: QC, Language: Lang } = await getSdk();

	// Fetch credentials from Secrets Manager
	const { clientId, clientSecret } = await getQuranApiCredentials();
	const oauthUrl = process.env.QURAN_API_OAUTH_URL || 'https://prelive-oauth2.quran.foundation';

	// The SDK is expected to handle OAuth internally using provided creds
	cachedClient = new QC({
		clientId,
		clientSecret,
		oauthUrl,
		defaults: {
			language: Lang.ENGLISH || 'en'
		}
	});
	return cachedClient;
}

function randomInt(min, max) {
	return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getRandomAyahRich() {
	const client = await getClient();
	try {
		console.log('[getRandomAyahRich] client keys:', Object.keys(client || {}));
		if (client?.audio) {
			console.log('[getRandomAyahRich] audio keys:', Object.keys(client.audio));
		}
	} catch {
		// ignore
	}

	// Get chapters (surahs) to pick a random verse location
	const chapters = await client.chapters.findAll();
	if (!Array.isArray(chapters) || chapters.length === 0) {
		throw new Error('Failed to load chapters from Quran API');
	}
	const pick = chapters[randomInt(0, chapters.length - 1)];
	const surahNumber = pick.id || pick.number || pick.chapter_number || pick.chapterNumber;
	const ayahInSurahCount = pick.verses_count || pick.versesCount || pick.numberOfAyahs || 7;
	const ayahNumber = randomInt(1, ayahInSurahCount);
	const verseKey = `${surahNumber}:${ayahNumber}`;

	// Defaults based on plan
	// Note: translation/tafsir/audio selector interfaces may vary by SDK version.
	// We attempt common fields and fall back gracefully.
	const verse = await client.verses.findByKey(verseKey, {
		translations: [20, 131], // English + Urdu
		tafsirs: [171], // Ibn Kathir (en)
		reciter: 2, // Mishary Alafasy
		fields: {
			textUthmani: true,
			textIndopak: true,
			textImlaei: true,
			chapterId: true
		},
		translationFields: { languageName: true, resourceName: true },
		tafsirFields: { languageName: true, resourceName: true }
	});
	try {
		console.log('[getRandomAyahRich] verseKey', verseKey, 'raw response:', JSON.stringify(verse));
	} catch {
		// ignore serialization errors
	}

	let textArabic =
		verse?.textUthmani ||
		verse?.textUthmaniSimple ||
		verse?.textIndopak ||
		verse?.textImlaei ||
		verse?.text ||
		verse?.verse?.text ||
		'';
	let surahNameEnglish =
		verse?.chapter?.nameSimple ||
		verse?.chapter?.nameEn ||
		verse?.chapter?.nameEnglish ||
		pick?.name_simple ||
		pick?.name_en ||
		pick?.nameSimple ||
		pick?.translatedName?.name ||
		'';
	let surahNameArabic =
		verse?.chapter?.nameArabic ||
		verse?.surah?.name ||
		verse?.chapter?.nameAr ||
		pick?.name_arabic ||
		pick?.name_ar ||
		pick?.nameArabic ||
		'';

let textEnglish = '';
let textUrdu = '';
if (Array.isArray(verse?.translations)) {
		for (const t of verse.translations) {
			const lang = (t.languageName || t.language || '').toLowerCase();
			const id = t.resourceId || t.id;
			if (!textEnglish && (lang.startsWith('en') || id === 20)) textEnglish = t.text || t.body || '';
			if (!textUrdu && (lang.startsWith('ur') || id === 131)) textUrdu = t.text || t.body || '';
		}
	}

let tafseerText = '';
if (Array.isArray(verse?.tafsirs)) {
	// prefer Urdu
	let ur = verse.tafsirs.find((t) => (t.languageName || t.language || '').toLowerCase().startsWith('ur'));
	let en = verse.tafsirs.find((t) => (t.languageName || t.language || '').toLowerCase().startsWith('en'));
	tafseerText = (ur && (ur.text || ur.body)) || (en && (en.text || en.body)) || '';
}
if (!tafseerText) {
	tafseerText = await fetchTafsirText(client, verseKey);
}

	let audioUrl = '';
	if (verse?.audio && (verse.audio.url || verse.audio.audioUrl)) {
		audioUrl = verse.audio.url || verse.audio.audioUrl;
	} else if (Array.isArray(verse?.audioFiles) && verse.audioFiles.length > 0) {
		audioUrl = verse.audioFiles[0].url || verse.audioFiles[0].audioUrl || '';
	} else {
		audioUrl = await fetchAudioUrl(client, verseKey);
	}

	return {
		surahNumber,
		ayahNumber,
		textArabic,
		textEnglish,
		textUrdu: textUrdu || undefined,
		tafseerText: tafseerText || undefined,
		audioUrl: audioUrl || undefined,
		surahNameEnglish,
		surahNameArabic
	};
}

async function getRandomAyah() {
	// Backward compatible shape used by existing handlers; now enriched
	const rich = await getRandomAyahRich();
	const formatted = {
		surahNumber: rich.surahNumber,
		ayahNumber: rich.ayahNumber,
		textArabic: rich.textArabic,
		textEnglish: rich.textEnglish,
		surahNameEnglish: rich.surahNameEnglish,
		surahNameArabic: rich.surahNameArabic,
		textUrdu: rich.textUrdu,
		tafseerText: rich.tafseerText,
		audioUrl: rich.audioUrl
	};
	try {
		console.log('[getRandomAyah] formatted payload:', JSON.stringify(formatted));
	} catch {
		// ignore serialization errors
	}
	return formatted;
}

module.exports = {
	getRandomAyah,
	getRandomAyahRich
};

async function fetchAudioUrl(client, verseKey) {
	const recitationId = Number(process.env.QURAN_AUDIO_RECITER_ID || 2);
	if (!client?.audio?.findVerseRecitationsByKey) return '';
	try {
		const response = await client.audio.findVerseRecitationsByKey(verseKey, recitationId, { format: 'mp3' });
		try {
			console.log('[fetchAudioUrl] response', JSON.stringify(response));
		} catch {
			// ignore
		}
		const files =
			(Array.isArray(response?.audio_files) && response.audio_files.length > 0 && response.audio_files) ||
			(Array.isArray(response?.audioFiles) && response.audioFiles.length > 0 && response.audioFiles) ||
			null;
		if (files && files.length > 0) {
			return normalizeAudioUrl(files[0].audio_url || files[0].audioUrl || files[0].url);
		}
		const file = response?.audio_file || response?.audioFile || response?.audio || null;
		if (file) {
			return normalizeAudioUrl(file.audio_url || file.audioUrl || file.url);
		}
		console.warn('[fetchAudioUrl] Unexpected audio API response shape', response);
		return '';
	} catch (err) {
		console.warn('[fetchAudioUrl] failed to fetch audio for', verseKey, err);
		return '';
	}
}

function normalizeAudioUrl(path) {
	if (!path) return '';
	if (/^https?:\/\//i.test(path)) return path;
	return `https://audio.qurancdn.com/${path.replace(/^\/+/, '')}`;
}

async function fetchTafsirText(client, verseKey) {
	const tafsirId = Number(process.env.QURAN_TAFSIR_ID || 171);
	if (tafsirId && client?.fetcher) {
		try {
			const response = await client.fetcher.fetch(
				`/content/api/v4/tafsirs/${tafsirId}/by_ayah/${verseKey}`,
				{}
			);
			try {
				console.log('[fetchTafsirText] response', JSON.stringify(response));
			} catch {
				// ignore
			}
			const entry =
				(response?.tafsir && response.tafsir) ||
				(Array.isArray(response?.tafsirs) && response.tafsirs.length > 0 && response.tafsirs[0]) ||
				null;
			if (entry) {
				return entry.text || entry.body || '';
			}
			console.warn('[fetchTafsirText] unexpected response shape', response);
		} catch (err) {
			console.warn('[fetchTafsirText] failed for', verseKey, err);
		}
	}
	return fetchPublicTafsir(verseKey);
}

async function fetchPublicTafsir(verseKey) {
	if (typeof fetch !== 'function') return '';
	const tafsirId = Number(process.env.QURAN_TAFSIR_FALLBACK_ID || 169);
	const url = `https://api.quran.com/api/v4/tafsirs/${tafsirId}/by_ayah/${verseKey}?language=en`;
	try {
		const res = await fetch(url);
		if (!res.ok) {
			console.warn('[fetchPublicTafsir] non-OK response', res.status);
			return '';
		}
		const payload = await res.json();
		try {
			console.log('[fetchPublicTafsir] response', JSON.stringify(payload));
		} catch {
			// ignore
		}
		const entry =
			payload?.tafsir ||
			(Array.isArray(payload?.tafsirs) && payload.tafsirs.length > 0 && payload.tafsirs[0]) ||
			null;
		if (entry) {
			return entry.text || entry.body || '';
		}
		return '';
	} catch (err) {
		console.warn('[fetchPublicTafsir] failed', err);
		return '';
	}
}
