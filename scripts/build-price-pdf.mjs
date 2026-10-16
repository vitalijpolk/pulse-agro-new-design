// Збирає PDF-прайс з даних сайту: склад і порядок — src/data/price-list.ts,
// ціни, ФАО, вегетація, вовчок і виробник — з карток товарів.
// Так PDF ніколи не розходиться з сайтом.
// Запуск: node scripts/build-price-pdf.mjs   →   public/files/prais-pulse-agro-2026.pdf

import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';
import { pathToFileURL } from 'url';
import { PRICE_LIST, PRICE_LIST_PDF, PRICE_LIST_UPDATED, TIER_LABELS } from '../src/data/price-list.ts';

const root = process.cwd();
const products = Object.fromEntries(
  fs.readdirSync('src/content/products').map((f) => {
    const d = JSON.parse(fs.readFileSync(path.join('src/content/products', f), 'utf-8'));
    return [d.slug, d];
  }),
);
const manufacturers = Object.fromEntries(
  JSON.parse(fs.readFileSync('src/content/manufacturers.json', 'utf-8')).map((m) => [m.id, m.name]),
);
const MANUFACTURER_LABEL = { 'Pulse-agro': 'Pulse Agro' };

const spec = (p, re) =>
  p.specs.flatMap((g) => g.items).find((i) => re.test(i.label))?.value ?? '';

const vegetation = (p) => {
  const v = spec(p, /Вегетаційний період/i) || (p.description.match(/(\d+(?:[–-]\d+)?) днів/) || [])[1] || '';
  return v.replace(/\s*днів/, '').replace('-', '–');
};
const broomrape = (p) =>
  spec(p, /вовч|заразих/i).replace(/раси |стійкість до рас /g, '').replace(/А/g, 'A').replace(/-/g, '–');
const maker = (p) => {
  const n = manufacturers[p.manufacturer] ?? '';
  return MANUFACTURER_LABEL[n] ?? n;
};
const price = (p, tier) => {
  const v = p.priceTiers.find((t) => t.tier === tier)?.price;
  return v && v > 0 ? v.toLocaleString('uk-UA') : '—';
};
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

function tableHtml(t) {
  const allRows = t.groups.flatMap((g) => g.rows);
  const merged = new Map();
  if (t.groups.every((g) => !g.title)) {
    for (const tier of t.mergeTiers ?? []) {
      const values = allRows.map((r) => price(products[r.slug], tier));
      if (values.every((v) => v === values[0])) merged.set(tier, values[0]);
    }
  }
  const isCorn = t.noteLabel === 'ФАО';
  const head = isCorn
    ? ['Назва гібриду', 'ФАО', 'Виробник']
    : ['Назва гібриду', 'Вегетаційний період, днів', 'Стійкість до вовчка', 'Виробник'];
  const cols = head.length + t.tiers.length;
  const rows = t.groups
    .map((g) => {
      const groupRow = g.title ? `<tr class="group"><td colspan="${cols}">${esc(g.title)}</td></tr>` : '';
      const body = g.rows
        .map((r) => {
          const p = products[r.slug];
          if (!p) throw new Error(`Немає товару ${r.slug}`);
          const name = esc(r.name.toUpperCase()) + (!isCorn && r.note ? ` <span class="note">(${esc(r.note)})</span>` : '');
          const meta = isCorn
            ? [r.note, maker(p)]
            : [vegetation(p) || '—', broomrape(p) || '—', maker(p)];
          const single = p.priceTiers.length === 1 && !t.tiers.includes(p.priceTiers[0].tier);
          const prices = single
            ? `<td class="num" colspan="${t.tiers.length}">${p.priceTiers[0].price.toLocaleString('uk-UA')}</td>`
            : t.tiers
                .map((tier) =>
                  merged.has(tier)
                    ? r.slug === allRows[0].slug
                      ? `<td class="num merged" rowspan="${allRows.length}">${merged.get(tier)}</td>`
                      : ''
                    : `<td class="num">${price(p, tier)}</td>`,
                )
                .join('');
          return `<tr><td class="name">${name}</td>${meta.map((m) => `<td>${esc(m)}</td>`).join('')}${prices}</tr>`;
        })
        .join('');
      return groupRow + body;
    })
    .join('');
  return `
  <h2>${esc(t.title.toUpperCase())} РОКУ</h2>
  <table>
    <thead>
      <tr>${head.map((h) => `<th rowspan="2">${h}</th>`).join('')}<th colspan="${t.tiers.length}">Ціна, грн/п.о.</th></tr>
      <tr>${t.tiers.map((tier) => `<th class="sub">${TIER_LABELS[tier]}</th>`).join('')}</tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
  <p class="pack">${esc(t.packaging)}</p>${t.extraNote ? `<p class="pack">${esc(t.extraNote)}</p>` : ''}`;
}

const logo = pathToFileURL(path.join(root, 'public/images/site/logo-original.png')).href;
const html = `<!doctype html><html lang="uk"><head><meta charset="utf-8"><title>Прайс Pulse Agro 2026</title>
<style>
  @page { size: A4; margin: 14mm 12mm 16mm; }
  * { box-sizing: border-box; }
  body { font-family: Arial, 'Segoe UI', sans-serif; color: #1a1a1a; margin: 0; font-size: 11pt; }
  .top { display: flex; justify-content: space-between; align-items: center; border-bottom: 3px solid #e8772e; padding-bottom: 10px; }
  .top img { height: 54px; }
  .top .meta { text-align: right; font-size: 9.5pt; color: #555; line-height: 1.5; }
  .top .meta b { color: #1a1a1a; font-size: 13pt; }
  h2 { text-align: center; font-size: 13pt; margin: 22px 0 10px; text-decoration: underline; }
  table { width: 100%; border-collapse: collapse; font-size: 10pt; }
  th, td { border: 1px solid #8a8a8a; padding: 5px 7px; text-align: center; }
  th { background: #e8772e; color: #fff; font-weight: 700; }
  th.sub { font-weight: 600; background: #f0a36f; color: #1a1a1a; }
  td.name { text-align: left; font-weight: 700; }
  td.num { font-variant-numeric: tabular-nums; }
  td.merged { font-weight: 700; font-size: 12pt; vertical-align: middle; }
  .note { font-weight: 400; color: #555; font-size: 9pt; }
  tr.group td { background: #fbe1cd; font-weight: 700; color: #1a1a1a; }
  .pack { font-size: 9.5pt; color: #333; margin: 8px 0 0; padding: 7px 10px; background: #f6f2ec; border-radius: 4px; }
  .foot { position: fixed; bottom: 0; left: 0; right: 0; border-top: 2px solid #1c1c1c; padding-top: 6px; display: flex; justify-content: space-between; font-size: 9pt; color: #333; }
</style></head><body>
  <div class="top">
    <img src="${logo}" alt="Pulse Agro">
    <div class="meta"><b>Прайс на насіння 2026</b><br>Ціни дійсні з ${PRICE_LIST_UPDATED}<br>Для замовлень від 100 п.о. — оптові умови</div>
  </div>
  ${PRICE_LIST.map(tableHtml).join('')}
  <div class="foot">
    <span>+38 (097) 312-53-18 · +38 (099) 452-79-49</span>
    <span>info@pulse-agro.com · pulse-agro.com</span>
    <span>ТОВ «ПУЛЬС АГРО»</span>
  </div>
</body></html>`;

const tmpHtml = path.join(root, 'scripts', '.price-list.html');
fs.writeFileSync(tmpHtml, html);
const out = process.argv[2] ? path.resolve(process.argv[2]) : path.join(root, 'public', PRICE_LIST_PDF);
const chrome = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/usr/bin/google-chrome',
].find((p) => fs.existsSync(p));
if (!chrome) throw new Error('Не знайдено Chrome для друку PDF');
// Друкуємо в тимчасовий файл, потім копіюємо: якщо PDF відкритий у переглядачі, Windows не дасть його перезаписати
const tmpPdf = path.join(root, 'scripts', '.price-list.pdf');
fs.rmSync(tmpPdf, { force: true });
execFileSync(chrome, ['--headless=new', '--disable-gpu', '--no-pdf-header-footer', `--print-to-pdf=${tmpPdf}`, pathToFileURL(tmpHtml).href], { stdio: 'ignore' });
fs.rmSync(tmpHtml);
if (!fs.existsSync(tmpPdf)) throw new Error('Chrome не створив PDF');
try {
  fs.copyFileSync(tmpPdf, out);
} catch (e) {
  throw new Error(`Не вдалося перезаписати ${out} — закрийте PDF у переглядачі й запустіть знову (${e.code})`);
} finally {
  fs.rmSync(tmpPdf, { force: true });
}
console.log(`✅ PDF: ${out} (${(fs.statSync(out).size / 1024).toFixed(0)} KB)`);
