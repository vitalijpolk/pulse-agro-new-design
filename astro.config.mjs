// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// Фото всередині статей (markdown) — ліниве завантаження, щоб не гальмувати відкриття сторінки
function rehypeLazyImages() {
  /** @param {any} node */
  const visit = (node) => {
    if (node.type === 'element' && node.tagName === 'img') {
      node.properties.loading = 'lazy';
      node.properties.decoding = 'async';
    }
    node.children?.forEach(visit);
  };
  return visit;
}

// Місце для блоку заявки посередині статті: перед 3-м розділом (h2), якщо після нього ще є розділи.
// Сам блок (LeadBlock) копіюється туди на сторінці статті — див. src/pages/[slug].astro
function rehypeLeadSlot() {
  /** @param {any} tree @param {any} file */
  return (tree, file) => {
    if (!String(file.path || file.history?.[0] || '').replace(/\\/g, '/').includes('/content/posts/')) return;
    const h2 = tree.children.filter((/** @type {any} */ n) => n.type === 'element' && n.tagName === 'h2');
    const target = h2.length >= 4 ? h2[2] : h2.length >= 3 ? h2[1] : null;
    if (!target) return;
    tree.children.splice(tree.children.indexOf(target), 0, {
      type: 'element', tagName: 'div', properties: { className: ['lead-slot'] }, children: [],
    });
  };
}

// https://astro.build/config
export default defineConfig({
  site: 'https://pulse-agro.com',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    rehypePlugins: [rehypeLazyImages, rehypeLeadSlot],
  },
});
