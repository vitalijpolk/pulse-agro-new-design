// Обкладинка для блог-статті зі стоків через Openverse API (без ключа, лише CC0 / Public Domain)
// Пошук:       node scripts/fetch-stock-image.js search "sunflower field"
//              → список варіантів + прев'ю у scripts/.stock-preview/
// Завантажити: node scripts/fetch-stock-image.js get <slug> <id> [назва]
//              → public/images/posts/<slug>/<назва|cover>.jpg + запис у scripts/image-credits.json
//              (без назви — обкладинка cover.jpg, з назвою — фото для тексту статті)

import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const API = 'https://api.openverse.org/v1/images/';
const PREVIEW_DIR = path.join('scripts', '.stock-preview');
const CREDITS = path.join('scripts', 'image-credits.json');
const MAX_WIDTH = 1536;

const [, , cmd, ...args] = process.argv;

async function getJson(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'pulse-agro-cover-script' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.json();
}

// Wikimedia забороняє масове завантаження оригіналів — беремо їхню стандартну зменшену копію
function wikimediaThumb(url, width = 1600) {
  const m = url.match(/^https:\/\/upload\.wikimedia\.org\/wikipedia\/commons\/([0-9a-f])\/([0-9a-f]{2})\/(.+)$/);
  return m ? `https://upload.wikimedia.org/wikipedia/commons/thumb/${m[1]}/${m[2]}/${m[3]}/${width}px-${m[3]}` : url;
}

async function download(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'PulseAgroCoverScript/1.0 (https://pulse-agro.com)' } });
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

async function search(query) {
  const params = new URLSearchParams({
    q: query,
    license: 'cc0,pdm',
    aspect_ratio: 'wide',
    size: 'large',
    page_size: '12',
  });
  let data = await getJson(`${API}?${params}`);
  if (data.results.length < 4) {
    // вузька тема — шукаємо без обмежень за розміром і пропорціями
    params.delete('aspect_ratio');
    params.delete('size');
    data = await getJson(`${API}?${params}`);
  }
  fs.rmSync(PREVIEW_DIR, { recursive: true, force: true });
  fs.mkdirSync(PREVIEW_DIR, { recursive: true });

  console.log(`\n🔎 "${query}": знайдено ${data.result_count}, показую ${data.results.length}\n`);
  for (const [i, r] of data.results.entries()) {
    const n = String(i + 1).padStart(2, '0');
    console.log(`${n}. ${r.id}  ${r.width}×${r.height}  ${r.source}  «${r.title}» — ${r.creator ?? 'автор невідомий'}`);
    try {
      const buf = await download(r.thumbnail).catch(() => download(r.url));
      await sharp(buf).resize({ width: 600, withoutEnlargement: true }).jpeg({ quality: 75 })
        .toFile(path.join(PREVIEW_DIR, `${n}-${r.id}.jpg`));
    } catch (e) {
      console.log(`    ⚠️ прев'ю не завантажилось: ${e.message}`);
    }
  }
  console.log(`\nПрев'ю: ${PREVIEW_DIR}\nЗавантажити: node scripts/fetch-stock-image.js get <slug> <id>\n`);
}

async function get(slug, id, name = 'cover') {
  if (!slug || !id) throw new Error('Вкажи slug і id: node scripts/fetch-stock-image.js get <slug> <id>');
  const r = await getJson(`${API}${id}/`);
  if (!['cc0', 'pdm'].includes(r.license)) throw new Error(`Ліцензія ${r.license} — потрібна cc0 або pdm`);

  const buf = await download(wikimediaThumb(r.url)).catch(() => download(r.url));
  const dir = path.join('public', 'images', 'posts', slug);
  fs.mkdirSync(dir, { recursive: true });
  const out = path.join(dir, `${name}.jpg`);
  const info = await sharp(buf).rotate().resize({ width: MAX_WIDTH, withoutEnlargement: true })
    .jpeg({ quality: 82, mozjpeg: true }).toFile(out);

  const credits = fs.existsSync(CREDITS) ? JSON.parse(fs.readFileSync(CREDITS, 'utf-8')) : {};
  credits[`${slug}/${name}`] = {
    file: `/images/posts/${slug}/${name}.jpg`,
    title: r.title,
    creator: r.creator,
    source: r.source,
    license: r.license,
    landing: r.foreign_landing_url,
    openverseId: r.id,
    downloaded: new Date().toISOString().slice(0, 10),
  };
  fs.writeFileSync(CREDITS, JSON.stringify(credits, null, 2) + '\n');

  console.log(`✅ Збережено: ${out} (${info.width}×${info.height}, ${(info.size / 1024).toFixed(0)} KB)`);
  console.log(`   Джерело: ${r.foreign_landing_url} — ${r.creator ?? 'автор невідомий'}, ${r.license}`);
  console.log(`   Шлях: /images/posts/${slug}/${name}.jpg`);
  if (info.width < 900) console.log('   ⚠️ Ширина менше 900 px — обкладинка в статті показується до 760 px, на retina може бути нечітко');
}

try {
  if (cmd === 'search') await search(args.join(' '));
  else if (cmd === 'get') await get(args[0], args[1], args[2]);
  else console.log('Використання:\n  node scripts/fetch-stock-image.js search "<запит англійською>"\n  node scripts/fetch-stock-image.js get <slug> <id> [назва]');
} catch (e) {
  console.error('❌ Помилка:', e.message);
  process.exit(1);
}
