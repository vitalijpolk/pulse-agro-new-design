import { getCollection } from 'astro:content';

export async function GET() {
  const products = await getCollection('products');

  const items = products
    .filter((p) => {
      const min = Math.min(...p.data.priceTiers.map((t) => t.price));
      return min > 0 && p.data.images.length > 0;
    })
    .map((p) => {
      const minPrice = Math.min(...p.data.priceTiers.map((t) => t.price));
      const image = p.data.images[0];
      const availability = p.data.inStock ? 'in_stock' : 'out_of_stock';
      const desc = (p.data.description || p.data.tagline || p.data.title)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
      const title = p.data.title.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

      return `    <item>
      <g:id>${p.data.slug}</g:id>
      <g:title>${title}</g:title>
      <g:description>${desc}</g:description>
      <g:link>https://pulse-agro.com/product/${p.data.slug}/</g:link>
      <g:image_link>https://pulse-agro.com${image}</g:image_link>
      <g:availability>${availability}</g:availability>
      <g:price>${minPrice} UAH</g:price>
      <g:condition>new</g:condition>
      <g:brand>Pulse Agro</g:brand>
      <g:google_product_category>3418</g:google_product_category>
    </item>`;
    })
    .join('\n');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss xmlns:g="http://base.google.com/ns/1.0" version="2.0">
  <channel>
    <title>Pulse Agro — насіння агрокультур</title>
    <link>https://pulse-agro.com</link>
    <description>Насіння соняшнику, кукурудзи, пшениці, рапсу, ячменю, сої та гороху від Pulse Agro</description>
${items}
  </channel>
</rss>`;

  return new Response(xml, {
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
    },
  });
}
