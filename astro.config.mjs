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

// https://astro.build/config
export default defineConfig({
  site: 'https://pulse-agro.com',
  trailingSlash: 'always',
  integrations: [sitemap()],
  markdown: {
    rehypePlugins: [rehypeLazyImages],
  },
});
