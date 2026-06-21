import { glob } from 'astro/loaders';
import { defineCollection } from 'astro:content';
import { z } from 'astro/zod';

const works = defineCollection({
  loader: glob({ pattern: '**/[^_]*.mdx', base: './src/content/works' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    description: z.string(),
    page: z.enum(['design', 'content']),
    category: z.string(),
    type: z.enum(['image', 'video', 'audio', 'embed', 'collection']),
    status: z.enum(['published', 'archived']).default('published'),
    createdAt: z.coerce.date(),
    updatedAt: z.coerce.date(),
    thumbnail: z.string(),
    thumbnailAlt: z.string(),
    heroImage: z.string().optional(),
    heroImageAlt: z.string().optional(),
    videoUrl: z.string().optional().default(''),
    audioUrl: z.string().optional().default(''),
    embedUrl: z.string().optional().default(''),
    externalUrl: z.string().optional().default(''),
    aiTool: z.string().optional().default(''),
    tools: z.array(z.string()).default([]),
    tags: z.array(z.string()).default([]),
    license: z.string().default('CC BY-NC 4.0'),
    featured: z.boolean().default(false),
    draft: z.boolean().default(false),
    images: z
      .array(
        z.object({
          src: z.string(),
          alt: z.string(),
          caption: z.string().optional(),
        }),
      )
      .default([]),
    prompts: z.array(z.string()).default([]),
    provenance: z
      .object({
        source: z.string().optional(),
        notes: z.string().optional(),
        sha256: z.string().optional(),
      })
      .optional(),
  }),
});

export const collections = { works };
