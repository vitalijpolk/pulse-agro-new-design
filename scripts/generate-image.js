// Генерація обкладинки для блог-статті через OpenAI API (gpt-image-1)
// Використання: node scripts/generate-image.js <slug> "<опис зображення>"
// Приклад:      node scripts/generate-image.js "pshenytsya-podolyanka" "пшеничне поле в Україні, золотий колос, сонячний ранок"

import fs from 'fs';
import path from 'path';
import https from 'https';

// Читаємо .env
const envPath = new URL('../.env', import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && v.length) process.env[k.trim()] = v.join('=').trim();
  }
}

const KEY = process.env.OPENAI_API_KEY;
if (!KEY) { console.error('❌ Немає OPENAI_API_KEY у .env'); process.exit(1); }

const [,, slug, description] = process.argv;
if (!slug) { console.error('❌ Вкажи slug: node scripts/generate-image.js <slug> "<опис>"'); process.exit(1); }

const prompt = description
  ? `Professional agricultural photography for a Ukrainian farming website. ${description}. Realistic photo, Ukrainian countryside, beautiful natural lighting, no text, no watermarks, landscape orientation.`
  : `Professional agricultural photography for Ukrainian farming article "${slug.replace(/-/g,' ')}". Realistic crops, Ukrainian fields, golden hour lighting. No text, no watermarks.`;

console.log(`\n🎨 Генерую обкладинку для: ${slug}`);
console.log(`   Промпт: ${prompt.substring(0, 80)}...\n`);

const body = JSON.stringify({
  model: 'gpt-image-1',
  prompt,
  n: 1,
  size: '1536x1024',
  output_format: 'jpeg',
});

const req = https.request({
  hostname: 'api.openai.com',
  path: '/v1/images/generations',
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${KEY}`,
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(body),
  }
}, res => {
  let buf = '';
  res.on('data', c => buf += c);
  res.on('end', () => {
    const data = JSON.parse(buf);
    if (data.error) { console.error('❌ Помилка:', data.error.message); process.exit(1); }

    const imgData = data.data?.[0];
    if (!imgData) { console.error('❌ Немає зображення у відповіді'); process.exit(1); }

    const imgDir = path.join('public', 'images', 'posts', slug);
    fs.mkdirSync(imgDir, { recursive: true });
    const imgPath = path.join(imgDir, 'cover.jpg');

    if (imgData.b64_json) {
      fs.writeFileSync(imgPath, Buffer.from(imgData.b64_json, 'base64'));
    } else if (imgData.url) {
      // якщо URL — качаємо
      https.get(imgData.url, r => { r.pipe(fs.createWriteStream(imgPath)); r.on('end', done); });
      return;
    }
    done();

    function done() {
      const sizeMb = (fs.statSync(imgPath).size / 1024 / 1024).toFixed(1);
      console.log(`✅ Збережено: ${imgPath} (${sizeMb} MB)`);
      console.log(`   Шлях для frontmatter: /images/posts/${slug}/cover.jpg\n`);
    }
  });
});

req.on('error', e => { console.error('❌ Мережева помилка:', e.message); });
req.write(body);
req.end();
