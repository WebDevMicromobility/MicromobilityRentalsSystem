// Generates cities/<iso2>.json: every city of every country the app offers as a country of
// residence, for the city-of-residence picker. The app fetches one country's file when that
// country is chosen, so none of this weighs on the page itself.
//
// This is NOT part of build:html. The data only changes when someone refreshes it, and the
// output is committed. To refresh, download these from https://download.geonames.org/export/dump/
// into one folder (unzip the .zip files) and point the script at it:
//
//   cities15000.txt        every place over 15,000 people, and every capital
//   cities1000.txt         every place over 1,000 people (Saudi Arabia is drawn from this)
//   admin1CodesASCII.txt   region names, to tell apart two cities that share a name
//   alternateNamesV2.txt   English and Arabic names (a file of just the en/ar rows also works)
//
//   node scripts/build-cities.mjs ~/Downloads/geonames
//
// Each file is a JSON array of [English name] or [English name, Arabic name]. The English
// name is what customers.city stores, so a name that was selectable before must stay exactly
// as it was: the hand-made lists that preceded this data (LEGACY below) are matched to their
// GeoNames rows and keep their spelling and their Arabic.
import { createReadStream } from 'node:fs';
import { readFile, writeFile, mkdir, readdir, rm } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { join } from 'node:path';

const src = process.argv[2];
if (!src) { console.error('usage: node scripts/build-cities.mjs <folder with the GeoNames files>'); process.exit(1); }
const root = new URL('../', import.meta.url);
const outDir = new URL('cities/', root);

// The country list is the app's own: NATIONALITIES in app.src.html, which the country of
// residence picker also shows. Israel is not on it, so it gets no file.
const app = await readFile(new URL('app.src.html', root), 'utf8');
const natSrc = app.match(/const NATIONALITIES=(\[[\s\S]*?\]\]);/);
if (!natSrc) throw new Error('build-cities: NATIONALITIES not found in app.src.html');
const COUNTRIES = new Function(`return ${natSrc[1]};`)();   // [[iso2, English name], ...]

// The picker's lists before this data existed. Riders saved these exact names, so they win
// over GeoNames' spelling of the same place ("Khobar", not "Al Khobar").
const LEGACY = {
  'Saudi Arabia': ['Riyadh', 'Jeddah', 'Mecca', 'Medina', 'Dammam', 'Khobar', 'Dhahran', 'Taif', 'Tabuk', 'Buraydah', 'Khamis Mushait', 'Abha', 'Hail', 'Najran', 'Jazan', 'Al Hofuf', 'Yanbu', 'Jubail', 'Qatif', 'Hafar Al-Batin', 'Arar', 'Sakaka', 'Al Bahah', 'Unaizah', 'Al Kharj'],
  'United Arab Emirates': ['Dubai', 'Abu Dhabi', 'Sharjah', 'Al Ain', 'Ajman', 'Ras Al Khaimah', 'Fujairah', 'Umm Al Quwain'],
  'Kuwait': ['Kuwait City', 'Hawalli', 'Salmiya', 'Al Ahmadi', 'Al Jahra', 'Farwaniya', 'Fahaheel'],
  'Qatar': ['Doha', 'Al Rayyan', 'Al Wakrah', 'Al Khor', 'Lusail', 'Umm Salal'],
  'Bahrain': ['Manama', 'Riffa', 'Muharraq', 'Hamad Town', 'Isa Town', 'Sitra'],
  'Oman': ['Muscat', 'Salalah', 'Sohar', 'Nizwa', 'Sur', 'Ibri', 'Seeb'],
  'Egypt': ['Cairo', 'Alexandria', 'Giza', 'Port Said', 'Suez', 'Luxor', 'Aswan', 'Mansoura', 'Tanta', 'Sharm El Sheikh'],
  'Jordan': ['Amman', 'Zarqa', 'Irbid', 'Aqaba', 'Salt', 'Madaba', 'Karak'],
  'Lebanon': ['Beirut', 'Tripoli', 'Sidon', 'Tyre', 'Zahle', 'Jounieh', 'Byblos'],
  'Syria': ['Damascus', 'Aleppo', 'Homs', 'Latakia', 'Hama', 'Tartus'],
  'Iraq': ['Baghdad', 'Basra', 'Mosul', 'Erbil', 'Najaf', 'Karbala', 'Kirkuk', 'Sulaymaniyah'],
  'Yemen': ['Sanaa', 'Aden', 'Taiz', 'Hodeidah', 'Mukalla', 'Ibb'],
  // Jerusalem is added to Palestine by name: GeoNames files East Jerusalem as a district.
  'Palestine': ['Jerusalem', 'Gaza', 'Ramallah', 'Hebron', 'Nablus', 'Bethlehem', 'Jenin'],
  'Sudan': ['Khartoum', 'Omdurman', 'Port Sudan', 'Kassala', 'Nyala', 'El Obeid'],
  'Morocco': ['Casablanca', 'Rabat', 'Marrakesh', 'Fez', 'Tangier', 'Agadir', 'Meknes'],
  'Algeria': ['Algiers', 'Oran', 'Constantine', 'Annaba', 'Blida', 'Setif'],
  'Tunisia': ['Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte', 'Gabes'],
  'Libya': ['Tripoli', 'Benghazi', 'Misrata', 'Zawiya', 'Sabha'],
  'Turkey': ['Istanbul', 'Ankara', 'Izmir', 'Bursa', 'Antalya', 'Adana', 'Gaziantep', 'Konya'],
  'Pakistan': ['Karachi', 'Lahore', 'Islamabad', 'Rawalpindi', 'Faisalabad', 'Multan', 'Peshawar', 'Quetta'],
  'India': ['Mumbai', 'Delhi', 'Bengaluru', 'Hyderabad', 'Chennai', 'Kolkata', 'Pune', 'Ahmedabad', 'Kochi'],
  'Bangladesh': ['Dhaka', 'Chittagong', 'Khulna', 'Rajshahi', 'Sylhet'],
  'Philippines': ['Manila', 'Quezon City', 'Davao', 'Cebu City', 'Makati', 'Caloocan'],
  'Indonesia': ['Jakarta', 'Surabaya', 'Bandung', 'Medan', 'Semarang', 'Makassar'],
  'United Kingdom': ['London', 'Manchester', 'Birmingham', 'Leeds', 'Glasgow', 'Liverpool', 'Edinburgh', 'Bristol'],
  'United States': ['New York', 'Los Angeles', 'Chicago', 'Houston', 'Phoenix', 'San Francisco', 'Seattle', 'Boston', 'Miami', 'Dallas'],
  'Canada': ['Toronto', 'Vancouver', 'Montreal', 'Calgary', 'Ottawa', 'Edmonton'],
  'France': ['Paris', 'Marseille', 'Lyon', 'Toulouse', 'Nice', 'Nantes', 'Bordeaux'],
  'Germany': ['Berlin', 'Munich', 'Hamburg', 'Cologne', 'Frankfurt', 'Stuttgart', 'Dusseldorf'],
};
// Arabic that wins over GeoNames': the curated names the app carried for Saudi cities, and a
// few where GeoNames is off.
const LEGACY_AR = {
  'Riyadh': 'الرياض', 'Jeddah': 'جدة', 'Mecca': 'مكة المكرمة', 'Medina': 'المدينة المنورة', 'Dammam': 'الدمام', 'Khobar': 'الخبر', 'Dhahran': 'الظهران', 'Taif': 'الطائف', 'Tabuk': 'تبوك', 'Buraydah': 'بريدة', 'Khamis Mushait': 'خميس مشيط', 'Abha': 'أبها', 'Hail': 'حائل', 'Najran': 'نجران', 'Jazan': 'جازان', 'Al Hofuf': 'الهفوف', 'Yanbu': 'ينبع', 'Jubail': 'الجبيل', 'Qatif': 'القطيف', 'Hafar Al-Batin': 'حفر الباطن', 'Arar': 'عرعر', 'Sakaka': 'سكاكا', 'Al Bahah': 'الباحة', 'Unaizah': 'عنيزة', 'Al Kharj': 'الخرج',
  'Jerusalem': 'القدس',
  // GeoNames names the emirate or a newer district, not the city.
  'Sharjah': 'الشارقة', 'Seeb': 'السيب', 'Umm Salal': 'أم صلال',
};
// Legacy names GeoNames does not list under any spelling: the place each one meant.
const LEGACY_ALIAS = { 'Farwaniya': 'Al Farwaniyah', 'Umm Salal': 'Umm Salal Muhammad', 'Hodeidah': 'Al Hudaydah' };
// The home market gets every town of 1,000 people or more; everywhere else, every city of
// 15,000 or more and every capital. (Every place of 1,000 would put 17,000 names in the
// United States list.)
const FINE_GRAINED = new Set(['SA']);
// Districts of a city, and places that no longer exist or are settlements. Not cities of
// residence.
const SKIP_FEATURES = new Set(['PPLX', 'PPLH', 'PPLQ', 'PPLW', 'PPLCH', 'STLMT']);
// Single rows the feature codes miss: Atarot, an Israeli industrial zone filed as a Palestinian town.
const SKIP_IDS = new Set(['284572']);
// Countries whose own script is not Latin. GeoNames spells their places in scholarly
// transliteration ("Ţurayf", "Şabyā"), which nobody types; these take an English name or the
// plain-ASCII spelling instead. Latin-script countries keep their own accents (São Paulo).
const NON_LATIN = new Set(('SA AE KW QA BH OM EG JO LB SY IQ YE PS SD SS MA DZ TN LY MR SO DJ KM ' +
  'IR AF PK BD IN NP LK BT MV MM TH LA KH CN TW JP KR KP MN RU UA BY BG RS MK KZ KG TJ UZ TM ' +
  'GE AM AZ GR CY ET ER').split(' '));

const COUNTRY_CODES = new Set(COUNTRIES.map(([c]) => c));
const fold = (s) => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isArabic = (s) => /^[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF\s'-]+$/.test(s) && /[\u0600-\u06FF]/.test(s);
// Straight apostrophes, no leading one ('Inak sorted above every A), a capital first letter.
const tidy = (s) => {
  const t = String(s).replace(/[`‘’ʿʾ]/g, "'").replace(/\s+/g, ' ').trim().replace(/^'+/, '');
  return t.charAt(0).toUpperCase() + t.slice(1);
};
// Arabic without the vowel marks some GeoNames names carry (اَلأَحْمَدِي), as it is written on signs.
const tidyAr = (s) => String(s).replace(/[\u064B-\u065F\u0670\u0640\u06D6-\u06ED]/g, '')
  .replace(/\u0672/g, '\u0623').replace(/\u0673/g, '\u0625').replace(/\u0671/g, '\u0627').replace(/\s+/g, ' ').trim();

async function lines(file, fn) {
  const rl = createInterface({ input: createReadStream(join(src, file)), crlfDelay: Infinity });
  for await (const line of rl) if (line && line[0] !== '#') fn(line.split('\t'));
}

// ── Rows ──────────────────────────────────────────────────────────────────────
const place = (f) => ({
  id: f[0], name: f[1], ascii: f[2], alts: f[3] ? f[3].split(',') : [], feature: f[7], cc: f[8],
  admin1: f[10], pop: Number(f[14]) || 0, lat: Number(f[4]), lon: Number(f[5]),
});
const coarse = new Map(), fine = new Map();   // iso2 -> [place]
const push = (m, p) => { if (!m.has(p.cc)) m.set(p.cc, []); m.get(p.cc).push(p); };
await lines('cities15000.txt', (f) => { if (COUNTRY_CODES.has(f[8])) push(coarse, place(f)); });
await lines('cities1000.txt', (f) => { if (COUNTRY_CODES.has(f[8])) push(fine, place(f)); });

const admin1 = new Map();   // 'SA.10' -> {name, id}
await lines('admin1CodesASCII.txt', (f) => admin1.set(f[0], { name: f[1], id: f[3] }));

// ── English and Arabic names, for the places above and their regions ─────────
const wanted = new Set();
for (const m of [coarse, fine]) for (const ps of m.values()) for (const p of ps) wanted.add(p.id);
for (const a of admin1.values()) wanted.add(a.id);
const names = new Map();   // geonameid -> {en: [...], ar: [...]}
await lines('alternateNamesV2.txt', (f) => {
  const [, id, lang, name, preferred, short, colloquial, historic] = f;
  if ((lang !== 'en' && lang !== 'ar') || !wanted.has(id) || colloquial === '1' || historic === '1') return;
  if (!names.has(id)) names.set(id, { en: [], ar: [] });
  // Preferred names first, then short ones, then the rest in file order.
  names.get(id)[lang].push({ name: name.replace(/\s*\(.*?\)\s*/g, ' ').trim(), rank: preferred === '1' ? 0 : short === '1' ? 1 : 2 });
});
const best = (id, lang, ok) => {
  const list = (names.get(id)?.[lang] || []).filter((n) => n.name && ok(n.name));
  list.sort((a, b) => a.rank - b.rank);
  return list[0]?.name || '';
};
const plain = (s) => /^[A-Za-z0-9 '.,-]+$/.test(s);
function englishName(p) {
  if (!NON_LATIN.has(p.cc)) return tidy(p.name);
  const en = best(p.id, 'en', plain);
  return tidy(en || p.ascii || p.name);
}
const arabicName = (id) => tidyAr(best(id, 'ar', isArabic));
const km = (a, b) => Math.hypot(a.lat - b.lat, (a.lon - b.lon) * Math.cos((a.lat * Math.PI) / 180)) * 111;
// Consonants only, so Turaif and Turayf, Unaizah and Unayzah come out the same.
const skeleton = (s) => fold(s).replace(/y/g, 'i').replace(/[aeiou]/g, '');

// ── One country ───────────────────────────────────────────────────────────────
function build(cc, country) {
  const rows = (FINE_GRAINED.has(cc) ? fine : coarse).get(cc) || [];
  const all = fine.get(cc) || [];
  const byId = new Map();
  for (const p of rows) {
    if (SKIP_FEATURES.has(p.feature) || SKIP_IDS.has(p.id)) continue;
    byId.set(p.id, { ...p, en: englishName(p), ar: arabicName(p.id), legacy: false });
  }
  // A legacy name claims the largest place that answers to it, from the wider file if need
  // be (Lusail and Byblos are under 15,000). No match at all still keeps the name.
  for (const want of LEGACY[country] || []) {
    const keys = new Set([fold(want), fold(LEGACY_ALIAS[want] || want)]);
    const hit = [...rows, ...all]
      .filter((p) => [p.name, p.ascii, ...p.alts, ...(names.get(p.id)?.en || []).map((n) => n.name)].some((n) => keys.has(fold(n))))
      .sort((a, b) => b.pop - a.pop)[0];
    const ar = LEGACY_AR[want] || (hit ? arabicName(hit.id) : '');
    if (process.env.CITIES_DEBUG) console.log(`${country}: ${want} <- ${hit ? `${hit.name} (${hit.pop})` : 'no match'}`);
    if (hit) byId.set(hit.id, { ...hit, en: want, ar, legacy: true });
    else byId.set(`legacy:${want}`, { id: `legacy:${want}`, en: want, ar, legacy: true, pop: Infinity, admin1: '' });
  }
  // GeoNames lists some towns twice under two spellings (Turaif and Turayf). Two entries
  // close together whose names share their consonants, or their Arabic name, are one town:
  // the legacy or the larger one stays.
  const ranked = [...byId.values()].sort((a, b) => Number(b.legacy) - Number(a.legacy) || b.pop - a.pop);
  const stays = [];
  for (const p of ranked) {
    const twin = stays.find((q) => p.lat != null && q.lat != null && km(p, q) < 15 &&
      (skeleton(p.en) === skeleton(q.en) || (p.ar && p.ar === q.ar && p.admin1 === q.admin1)));
    if (twin) { if (!twin.ar && p.ar) twin.ar = p.ar; byId.delete(p.id); } else stays.push(p);
  }
  // One entry per name. The same name twice in one region is one place listed twice (keep
  // the larger); in two regions it is two places, and both take the region's name.
  const groups = new Map();
  for (const p of byId.values()) {
    const k = fold(p.en);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k).push(p);
  }
  const out = [];
  for (const group of groups.values()) {
    group.sort((a, b) => Number(b.legacy) - Number(a.legacy) || b.pop - a.pop);
    const perRegion = new Map();
    for (const p of group) if (!perRegion.has(p.admin1)) perRegion.set(p.admin1, p);
    const kept = [...perRegion.values()];
    if (kept.length === 1 || kept[0].legacy) { out.push(kept[0]); if (kept.length === 1) continue; }
    for (const p of kept) {
      if (p.legacy) continue;
      const region = admin1.get(`${cc}.${p.admin1}`);
      if (!region) { out.push(p); continue; }   // nothing to tell it apart by; the dedupe below keeps the bigger
      const regionAr = arabicName(region.id);
      out.push({ ...p, en: `${p.en}, ${tidy(region.name)}`, ar: p.ar && regionAr ? `${p.ar}، ${regionAr}` : '' });
    }
  }
  // Still possible after the suffix: two unregioned namesakes. First one wins.
  const seen = new Set();
  return out
    .filter((p) => (seen.has(p.en) ? false : seen.add(p.en)))
    .sort((a, b) => a.en.localeCompare(b.en, 'en'))
    .map((p) => (p.ar ? [p.en, p.ar] : [p.en]));
}

await rm(outDir, { recursive: true, force: true });
await mkdir(outDir, { recursive: true });
let total = 0, withAr = 0;
const thin = [];
for (const [cc, country] of COUNTRIES) {
  const list = build(cc, country);
  if (!list.length) thin.push(country);
  total += list.length;
  withAr += list.filter((x) => x[1]).length;
  await writeFile(new URL(`${cc.toLowerCase()}.json`, outDir), JSON.stringify(list));
}
console.log(`build-cities: ${COUNTRIES.length} countries, ${total} cities (${withAr} with Arabic) -> cities/`);
if (thin.length) console.log(`build-cities: no cities for ${thin.join(', ')}`);
console.log(`build-cities: ${(await readdir(outDir)).length} files`);
