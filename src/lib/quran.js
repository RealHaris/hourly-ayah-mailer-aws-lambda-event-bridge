'use strict';

const API_BASE = 'https://api.alquran.cloud/v1';

async function fetchJson(url) {
  // Node 20 has global fetch
  const res = await fetch(url, { method: 'GET' });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${res.statusText} for ${url} ${text}`);
  }
  return res.json();
}

async function getMeta() {
  const meta = await fetchJson(`${API_BASE}/meta`);
  if (!meta || !meta.data || !meta.data.surahs || !Array.isArray(meta.data.surahs.references)) {
    throw new Error('Unexpected meta response from Quran API');
  }
  return meta.data.surahs.references;
}

function randomInt(min, max) {
  // inclusive min and max
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

async function getRandomAyah() {
  const references = await getMeta();
  const surahRef = references[randomInt(0, references.length - 1)];
  const ayahNumberInSurah = randomInt(1, surahRef.numberOfAyahs);

  const ayahResp = await fetchJson(
    `${API_BASE}/ayah/${surahRef.number}:${ayahNumberInSurah}/editions/quran-uthmani,en.sahih`
  );

  if (!ayahResp || !ayahResp.data || !Array.isArray(ayahResp.data) || ayahResp.data.length < 2) {
    throw new Error('Unexpected ayah response from Quran API');
  }

  let arabic, english;
  for (const item of ayahResp.data) {
    if (item.edition && item.edition.language === 'ar') {
      arabic = item;
    }
    if (item.edition && item.edition.language === 'en') {
      english = item;
    }
  }

  if (!arabic || !english) {
    throw new Error('Could not find both Arabic and English editions for ayah');
  }

  return {
    surahNumber: arabic.surah.number,
    ayahNumber: arabic.numberInSurah || ayahNumberInSurah,
    textArabic: arabic.text,
    textEnglish: english.text,
    surahNameEnglish: english.surah.englishName,
    surahNameArabic: arabic.surah.name
  };
}

module.exports = {
  getRandomAyah
};


