// Генерація блог-статті + обкладинки через OpenAI API
// Використання: node scripts/generate-post.js "тема статті"
// Приклад:      node scripts/generate-post.js "пшениця подолянка характеристики і врожайність"
//
// Потрібно: OPENAI_API_KEY у файлі .env (або в змінній середовища)

import fs from 'fs';
import path from 'path';
import https from 'https';

// --- Читаємо .env ---
const envPath = new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}

const OPENAI_KEY = process.env.OPENAI_API_KEY;
if (!OPENAI_KEY) {
  console.error('❌ Немає OPENAI_API_KEY. Додай у файл .env:\nOPENAI_API_KEY=sk-...');
  process.exit(1);
}

const topic = process.argv[2];
if (!topic) {
  console.error('❌ Вкажи тему: node scripts/generate-post.js "тема статті"');
  process.exit(1);
}

// --- Утиліти ---
function toSlug(str) {
  const uk = { 'а':'a','б':'b','в':'v','г':'h','ґ':'g','д':'d','е':'e','є':'ye','ж':'zh','з':'z','и':'y','і':'i','ї':'yi','й':'y','к':'k','л':'l','м':'m','н':'n','о':'o','п':'p','р':'r','с':'s','т':'t','у':'u','ф':'f','х':'kh','ц':'ts','ч':'ch','ш':'sh','щ':'shch','ь':'','ю':'yu','я':'ya' };
  return str.toLowerCase().replace(/[а-яіїєґ]/g, c => uk[c] || c).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

async function openai(endpoint, body) {
  const data = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: `/v1/${endpoint}`,
      method: 'POST',
      headers: { 'Authorization': `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(data) }
    }, res => {
      let buf = '';
      res.on('data', c => buf += c);
      res.on('end', () => {
        try { resolve(JSON.parse(buf)); } catch { reject(new Error(buf)); }
      });
    });
    req.on('error', reject);
    req.write(data);
    req.end();
  });
}

async function downloadFile(url, dest) {
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(dest);
    https.get(url, res => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        https.get(res.headers.location, res2 => { res2.pipe(file); file.on('finish', () => { file.close(); resolve(); }); });
      } else {
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }
    }).on('error', reject);
  });
}

// --- Генерація статті ---
const today = new Date().toISOString().split('T')[0];
const year = new Date().getFullYear();

console.log(`\n📝 Генерую статтю: "${topic}"\n`);

const articlePrompt = `Ти SEO-копірайтер агросайту pulse-agro.com (продаж насіння соняшнику, кукурудзи, пшениці, рапсу, ячменю, сої, гороху).

Напиши детальну SEO-статтю українською мовою на тему: "${topic}"

ВИМОГИ:
- Довжина: 1800–2500 слів
- Мова: українська, професійна але зрозуміла фермерам
- Структура: заголовок H1, вступ, 4-6 розділів H2, підрозділи H3 де доречно, висновок
- Де доречно — додай таблицю з даними (markdown-формат)
- Природньо згадуй Pulse Agro як надійного постачальника насіння
- Посилання на категорії: /product-category/seed/corn/ (кукурудза), /product-category/seed/sunflower/ (соняшник), /product-category/seed/wheat/ (пшениця), /product-category/seed/soy/ (соя), /product-category/seed/barley/ (ячмінь), /product-category/seed/pea/ (горох)
- НЕ додавай frontmatter — тільки текст статті починаючи з # Заголовок

Рік: ${year}. Сьогодні: ${today}.`;

const articleRes = await openai('chat/completions', {
  model: 'gpt-4o',
  messages: [{ role: 'user', content: articlePrompt }],
  max_tokens: 4000,
  temperature: 0.7,
});

if (articleRes.error) {
  console.error('❌ GPT помилка:', articleRes.error.message);
  process.exit(1);
}

const articleText = articleRes.choices[0].message.content.trim();

// Витягуємо H1 для title і slug
const h1Match = articleText.match(/^#\s+(.+)$/m);
const title = h1Match ? h1Match[1].trim() : topic;
const slug = toSlug(title).substring(0, 60);

// Витягуємо перший абзац для excerpt
const excerptMatch = articleText.replace(/^#.*$/m, '').trim().match(/^(.{80,200}?[.!?])/s);
const excerpt = excerptMatch ? excerptMatch[1].replace(/\n/g, ' ').trim() : topic;

console.log(`✅ Стаття згенерована: "${title}"`);
console.log(`   Slug: ${slug}`);

// --- Генерація обкладинки DALL-E 3 ---
console.log('\n🎨 Генерую обкладинку...');

const imagePrompt = `Professional agricultural photography for a Ukrainian farming website article about: "${topic}".
Realistic photo style: Ukrainian fields, crops, sunrise/sunset lighting, professional quality.
No text, no watermarks. Wide format, landscape orientation.`;

const imageRes = await openai('images/generations', {
  model: 'gpt-image-1',
  prompt: imagePrompt,
  n: 1,
  size: '1536x1024',
  output_format: 'jpeg',
});

if (imageRes.error) {
  console.warn('⚠️  Image помилка:', imageRes.error.message, '— стаття буде без обкладинки');
}

let coverImage = '';
const imgData = imageRes.data?.[0];
if (imgData) {
  const imgDir = path.join('public', 'images', 'posts', slug);
  fs.mkdirSync(imgDir, { recursive: true });
  const imgPath = path.join(imgDir, 'cover.jpg');

  if (imgData.url) {
    await downloadFile(imgData.url, imgPath);
  } else if (imgData.b64_json) {
    fs.writeFileSync(imgPath, Buffer.from(imgData.b64_json, 'base64'));
  }

  coverImage = `/images/posts/${slug}/cover.jpg`;
  console.log(`✅ Обкладинка збережена: ${imgPath}`);
}

// --- Frontmatter + збереження ---
const frontmatter = `---
title: "${title.replace(/"/g, '\\"')}"
slug: "${slug}"
publishDate: ${today}
excerpt: "${excerpt.replace(/"/g, '\\"').substring(0, 200)}"
${coverImage ? `coverImage: "${coverImage}"` : ''}
tags: []
---
`;

const mdContent = frontmatter + '\n' + articleText;
const mdPath = path.join('src', 'content', 'posts', `${slug}.md`);
fs.writeFileSync(mdPath, mdContent, 'utf-8');

console.log(`\n✅ Готово! Файл: ${mdPath}`);
console.log(`   Відкрий: http://localhost:4321/${slug}/`);
console.log(`\n   Щоб задеплоїти: git add -A && git commit -m "blog: ${title}" && git push\n`);
