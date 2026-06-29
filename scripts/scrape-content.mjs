// One-time migration script: pulls products, blog posts, and images from the
// live WordPress/WooCommerce site and writes them into src/content + public/images
// in the schema defined by src/content.config.ts. Re-run-safe: overwrites the
// same files each time, so it's fine to run again if the live site changes
// before launch.
import * as cheerio from 'cheerio';
import TurndownService from 'turndown';
import { gfm } from 'turndown-plugin-gfm';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'https://pulse-agro.com';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const turndown = new TurndownService({ headingStyle: 'atx' }).use(gfm);

const CATEGORIES = [
  { group: 'seed', slug: 'sunflower' },
  { group: 'seed', slug: 'corn' },
  { group: 'seed', slug: 'wheat' },
  { group: 'seed', slug: 'rapeseed' },
  { group: 'seed', slug: 'barley' },
  { group: 'seed', slug: 'pea' },
  { group: 'seed', slug: 'soy' },
  { group: 'zzr', slug: 'herbicides' },
  { group: 'zzr', slug: 'fungicides' },
  { group: 'zzr', slug: 'insecticides' },
  { group: 'zzr', slug: 'pesticides' },
  { group: 'zzr', slug: 'desiccants' },
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchHtml(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 (migration-scraper)' } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return cheerio.load(await res.text());
}

function productSlugFromHref(href) {
  return href?.match(/\/product\/([a-z0-9-]+)\/?(?:$|\?)/)?.[1];
}

const CYRILLIC_MAP = {
  а: 'a', б: 'b', в: 'v', г: 'h', ґ: 'g', д: 'd', е: 'e', є: 'ie', ж: 'zh', з: 'z',
  и: 'y', і: 'i', ї: 'yi', й: 'i', к: 'k', л: 'l', м: 'm', н: 'n', о: 'o', п: 'p',
  р: 'r', с: 's', т: 't', у: 'u', ф: 'f', х: 'kh', ц: 'ts', ч: 'ch', ш: 'sh',
  щ: 'shch', ь: '', ю: 'iu', я: 'ia', "'": '', '’': '',
};

function slugify(str) {
  return str
    .toLowerCase()
    .split('')
    .map((c) => CYRILLIC_MAP[c] ?? c)
    .join('')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function getOrCreateLookupId(lookupArr, name) {
  const existing = lookupArr.find((x) => x.name === name);
  if (existing) return existing.id;
  const base = slugify(name) || 'item';
  let id = base;
  let n = 1;
  while (lookupArr.some((x) => x.id === id)) id = `${base}-${++n}`;
  lookupArr.push({ id, name });
  return id;
}

async function downloadImage(url, destDir) {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = Buffer.from(await res.arrayBuffer());
    const filename = path.basename(new URL(url).pathname).replace(/[?#].*$/, '');
    await fs.mkdir(destDir, { recursive: true });
    await fs.writeFile(path.join(destDir, filename), buf);
    return filename;
  } catch {
    return null;
  }
}

// --- 1. Discover product -> category mapping by crawling category pages ---
async function discoverProductCategories() {
  const map = new Map();
  for (const cat of CATEGORIES) {
    let page = 1;
    while (true) {
      const url =
        page === 1
          ? `${BASE}/product-category/${cat.group}/${cat.slug}/`
          : `${BASE}/product-category/${cat.group}/${cat.slug}/page/${page}/`;
      let $;
      try {
        $ = await fetchHtml(url);
      } catch {
        break;
      }
      const hrefs = $('a.woocommerce-LoopProduct-link, ul.products a[href*="/product/"]')
        .map((_, el) => $(el).attr('href'))
        .get();
      const slugs = [...new Set(hrefs.map(productSlugFromHref).filter(Boolean))];
      if (slugs.length === 0) break;
      for (const slug of slugs) {
        if (!map.has(slug)) map.set(slug, { categoryGroup: cat.group, category: cat.slug });
      }
      const nextExists = $('a.next.page-numbers').length > 0;
      if (!nextExists) break;
      page++;
      await sleep(150);
    }
    console.log(`[categories] ${cat.group}/${cat.slug}: scanned`);
  }
  return map;
}

// --- 2. Scrape a single product page ---
async function scrapeProduct(slug, categoryInfo, manufacturers, technologies) {
  const url = `${BASE}/product/${slug}/`;
  const $ = await fetchHtml(url);

  const title = $('h1.product_title').first().text().trim() || $('h1').first().text().trim();
  const sku = $('.sku_wrapper .sku').first().text().trim() || undefined;

  let manufacturerName, technologyName;
  $('.woocommerce-product-attributes tr').each((_, tr) => {
    const label = $(tr).find('th').text().trim();
    const value = $(tr).find('td').text().trim();
    if (/виробник/i.test(label)) manufacturerName = value;
    if (/технологі/i.test(label)) technologyName = value;
  });
  const manufacturer = manufacturerName
    ? getOrCreateLookupId(manufacturers, manufacturerName)
    : 'unknown';
  const technology = technologyName ? getOrCreateLookupId(technologies, technologyName) : undefined;

  // Price tiers: variable products expose a JSON blob of variations + a
  // <select> with slug->label options; simple products just have one price.
  let priceTiers = [];
  const variationsRaw = $('form.variations_form').attr('data-product_variations');
  if (variationsRaw) {
    let variations = [];
    try {
      variations = JSON.parse(variationsRaw);
    } catch {
      variations = [];
    }
    const labelMap = {};
    $('form.variations_form select[name^="attribute_"]')
      .first()
      .find('option')
      .each((_, opt) => {
        const v = $(opt).attr('value');
        if (v) labelMap[v] = $(opt).text().trim();
      });
    priceTiers = variations
      .map((v) => {
        const attrKey = Object.keys(v.attributes ?? {})[0];
        const tierSlug = attrKey ? v.attributes[attrKey] : undefined;
        if (!tierSlug) return null;
        return {
          tier: tierSlug,
          label: labelMap[tierSlug] || tierSlug,
          price: Number(v.display_price),
        };
      })
      .filter(Boolean);
  }
  if (priceTiers.length === 0) {
    const priceText = $('.summary .price').first().text().replace(/\s+/g, ' ').trim();
    const priceNum = parseFloat(priceText.replace(/[^\d.,]/g, '').replace(',', '.'));
    priceTiers = [{ tier: 'default', label: 'Ціна', price: priceNum || 0 }];
  }

  // Description tab: intro paragraph(s) + <h3> sections of <li>Label: Value</li>
  const descRoot = $('#tab-description');
  let description = '';
  const specs = [];
  let currentSection = null;
  descRoot.children().each((_, el) => {
    const tag = el.tagName?.toLowerCase();
    const $el = $(el);
    if (tag === 'h2') return;
    if (tag === 'p' && !currentSection) {
      const text = $el.text().trim();
      if (text) description += (description ? '\n\n' : '') + text;
    } else if (tag === 'h3') {
      currentSection = { title: $el.text().trim(), items: [] };
      specs.push(currentSection);
    } else if (tag === 'ul' && currentSection) {
      $el.find('li').each((_, li) => {
        const text = $(li).text().trim();
        const idx = text.indexOf(':');
        if (idx > -1) {
          currentSection.items.push({ label: text.slice(0, idx).trim(), value: text.slice(idx + 1).trim() });
        } else if (text) {
          currentSection.items.push({ label: text, value: '' });
        }
      });
    }
  });
  if (!description) {
    description = $('.woocommerce-product-details__short-description').text().trim();
  }

  const imageUrls = [];
  $('.woocommerce-product-gallery__image').each((_, el) => {
    const a = $(el).find('a').first();
    const src = a.attr('data-large_image') || a.attr('href');
    if (src) imageUrls.push(src);
  });
  if (imageUrls.length === 0) {
    const og = $('meta[property="og:image"]').attr('content');
    if (og) imageUrls.push(og);
  }

  const relatedProducts = [
    ...new Set(
      $('.related.products a[href*="/product/"]')
        .map((_, el) => $(el).attr('href'))
        .get()
        .map(productSlugFromHref)
        .filter((s) => s && s !== slug),
    ),
  ];

  // Download images, rewrite to local paths
  const destDir = path.join(ROOT, 'public', 'images', 'products', slug);
  const images = [];
  for (const imgUrl of imageUrls) {
    const filename = await downloadImage(imgUrl, destDir);
    if (filename) images.push(`/images/products/${slug}/${filename}`);
  }

  return {
    title,
    slug,
    sku,
    categoryGroup: categoryInfo.categoryGroup,
    category: categoryInfo.category,
    manufacturer,
    technology,
    specs,
    priceTiers,
    description,
    images,
    relatedProducts,
    inStock: true,
  };
}

// --- 3. Discover + scrape blog posts ---
async function discoverPostUrls() {
  const res = await fetch(`${BASE}/post-sitemap1.xml`);
  const xml = await res.text();
  const blocks = [...xml.matchAll(/<url>([\s\S]*?)<\/url>/g)].map((m) => m[1]);
  return blocks
    .map((block) => ({
      url: block.match(/<loc>([^<]+)<\/loc>/)?.[1],
      lastmod: block.match(/<lastmod>([^<]+)<\/lastmod>/)?.[1],
    }))
    .filter((x) => x.url && x.url !== `${BASE}/` && !/\/category\/blog\/?$/.test(x.url));
}

async function scrapePost({ url, lastmod }) {
  const $ = await fetchHtml(url);
  const slug = url.replace(BASE, '').replace(/^\/+|\/+$/g, '');
  const title = $('h1').first().text().trim();
  const excerpt = $('meta[name="description"]').attr('content')?.trim() || '';
  const coverUrl =
    $('.catthumb img').first().attr('data-src') ||
    $('.catthumb noscript img').attr('src') ||
    $('meta[property="og:image"]').attr('content');

  const contentHtml = $('.blog-content').first().html() || '';
  const body = turndown.turndown(contentHtml).trim();

  let coverImage;
  if (coverUrl) {
    const destDir = path.join(ROOT, 'public', 'images', 'posts', slug);
    const filename = await downloadImage(coverUrl, destDir);
    if (filename) coverImage = `/images/posts/${slug}/${filename}`;
  }

  return {
    title,
    slug,
    publishDate: (lastmod || new Date().toISOString()).slice(0, 10),
    excerpt,
    coverImage,
    body,
  };
}

function yamlEscape(str) {
  return `"${String(str).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function writePostMarkdown(post) {
  const frontmatter = [
    '---',
    `title: ${yamlEscape(post.title)}`,
    `slug: ${yamlEscape(post.slug)}`,
    `publishDate: ${post.publishDate}`,
    `excerpt: ${yamlEscape(post.excerpt)}`,
    post.coverImage ? `coverImage: ${yamlEscape(post.coverImage)}` : null,
    'tags: []',
    '---',
    '',
  ]
    .filter((l) => l !== null)
    .join('\n');
  await fs.writeFile(path.join(ROOT, 'src', 'content', 'posts', `${post.slug}.md`), frontmatter + post.body + '\n');
}

async function main() {
  const only = process.argv[2]; // 'products' | 'posts' | undefined (both)
  const manufacturersPath = path.join(ROOT, 'src', 'content', 'manufacturers.json');
  const technologiesPath = path.join(ROOT, 'src', 'content', 'technologies.json');
  const manufacturers = JSON.parse(await fs.readFile(manufacturersPath, 'utf-8'));
  const technologies = JSON.parse(await fs.readFile(technologiesPath, 'utf-8'));

  if (!only || only === 'products') {
    console.log('Discovering product categories...');
    const productCategoryMap = await discoverProductCategories();
    console.log(`Found ${productCategoryMap.size} products across all categories.`);

    let i = 0;
    for (const [slug, categoryInfo] of productCategoryMap) {
      i++;
      console.log(`[product ${i}/${productCategoryMap.size}] ${slug}`);
      try {
        const product = await scrapeProduct(slug, categoryInfo, manufacturers, technologies);
        await fs.writeFile(
          path.join(ROOT, 'src', 'content', 'products', `${slug}.json`),
          JSON.stringify(product, null, 2) + '\n',
        );
      } catch (err) {
        console.error(`  FAILED: ${err.message}`);
      }
      await sleep(150);
    }

    await fs.writeFile(manufacturersPath, JSON.stringify(manufacturers, null, 2) + '\n');
    await fs.writeFile(technologiesPath, JSON.stringify(technologies, null, 2) + '\n');
  }

  if (only === 'products') {
    console.log('Done.');
    return;
  }

  console.log('Discovering blog posts...');
  const postUrls = await discoverPostUrls();
  console.log(`Found ${postUrls.length} posts.`);
  let i = 0;
  for (const entry of postUrls) {
    i++;
    console.log(`[post ${i}/${postUrls.length}] ${entry.url}`);
    try {
      const post = await scrapePost(entry);
      await writePostMarkdown(post);
    } catch (err) {
      console.error(`  FAILED: ${err.message}`);
    }
    await sleep(150);
  }

  console.log('Done.');
}

main();
