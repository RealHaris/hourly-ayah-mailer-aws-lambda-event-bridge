'use strict';

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
	const clientId = process.env.QURAN_API_CLIENT_ID || process.env.QURAN_CLIENT_ID;
	const clientSecret = process.env.QURAN_API_CLIENT_SECRET || process.env.QURAN_CLIENT_SECRET;
	const oauthUrl = process.env.QURAN_API_OAUTH_URL || 'https://prelive-oauth2.quran.foundation';
	if (!clientId || !clientSecret) {
		throw new Error('QURAN_API_CLIENT_ID and QURAN_API_CLIENT_SECRET must be set');
	}
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
		translations: ['en_khattab', 'ur_maududi'],
		tafsirs: ['ur_ibn_kathir', 'en_ibn_kathir'],
		recitation: 'mishary_alafasy',
		words: false
	});

	const textArabic =
		verse?.text_uthmani || verse?.text_arabic || verse?.text || verse?.verse?.text || '';
	const surahNameEnglish =
		verse?.chapter?.name_simple || verse?.chapter?.name_en || verse?.surah?.englishName || '';
	const surahNameArabic =
		verse?.chapter?.name_arabic || verse?.surah?.name || verse?.chapter?.name_ar || '';

	let textEnglish = '';
	let textUrdu = '';
	if (Array.isArray(verse?.translations)) {
		for (const t of verse.translations) {
			const lang = (t.language_name || t.language || '').toLowerCase();
			if (!textEnglish && (lang === 'english' || lang === 'en')) textEnglish = t.text || t.body || '';
			if (!textUrdu && (lang === 'urdu' || lang === 'ur')) textUrdu = t.text || t.body || '';
		}
	}

	let tafseerText = '';
	if (Array.isArray(verse?.tafsirs)) {
		// prefer Urdu
		let ur = verse.tafsirs.find((t) => (t.language || '').toLowerCase().startsWith('ur'));
		let en = verse.tafsirs.find((t) => (t.language || '').toLowerCase().startsWith('en'));
		tafseerText = (ur && (ur.text || ur.body)) || (en && (en.text || en.body)) || '';
	}

	let audioUrl = '';
	if (verse?.audio && (verse.audio.url || verse.audio.audio_url)) {
		audioUrl = verse.audio.url || verse.audio.audio_url;
	} else if (Array.isArray(verse?.audio_files) && verse.audio_files.length > 0) {
		audioUrl = verse.audio_files[0].url || verse.audio_files[0].audio_url || '';
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
	return {
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
}

module.exports = {
	getRandomAyah,
	getRandomAyahRich
};
