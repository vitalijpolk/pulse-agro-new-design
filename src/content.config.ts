import { defineCollection, z } from 'astro:content';
import { glob, file } from 'astro/loaders';

const products = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/products' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    sku: z.string().optional(),
    categoryGroup: z.enum(['seed', 'zzr']),
    category: z.string(),
    manufacturer: z.string(),
    technology: z.string().optional(),
    tagline: z.string().optional(),
    specs: z
      .array(
        z.object({
          title: z.string(),
          items: z.array(z.object({ label: z.string(), value: z.string() })),
        }),
      )
      .default([]),
    priceTiers: z
      .array(
        z.object({
          tier: z.string(),
          label: z.string(),
          price: z.number(),
          unit: z.string().optional(),
        }),
      )
      .min(1),
    description: z.string().default(''),
    images: z.array(z.string()).default([]),
    relatedProducts: z.array(z.string()).default([]),
    inStock: z.boolean().default(true),
  }),
});

const posts = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/posts' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    publishDate: z.coerce.date(),
    excerpt: z.string().default(''),
    coverImage: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    phone: z.string().optional(),
    email: z.string().optional(),
    address: z.string().optional(),
  }),
});

const manufacturers = defineCollection({
  loader: file('./src/content/manufacturers.json'),
  schema: z.object({ id: z.string(), name: z.string() }),
});

const technologies = defineCollection({
  loader: file('./src/content/technologies.json'),
  schema: z.object({ id: z.string(), name: z.string() }),
});

export const collections = { products, posts, pages, manufacturers, technologies };
