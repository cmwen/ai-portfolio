# AI Portfolio

Static Astro side portfolio for AI-generated works, experiments, and progress
records. Long-form writing, tags, search, and personal context live on the main
blog at <https://cmwen.github.io/>.

Production target:

```txt
https://cmwen.github.io/ai-portfolio/
```

The repository is intended to be named:

```txt
ai-portfolio
```

## Stack

- Astro 6
- TypeScript
- pnpm
- Tailwind CSS 4 via the Vite plugin
- Astro Content Collections
- MDX works
- Static output only
- GitHub Pages deployment with GitHub Actions

## Design Direction

The site is customized from the idea of the Astro Photography Portfolio Template:
a clean, responsive, media-first gallery with fast loading and minimal JavaScript.
This version changes the content model from photo albums to typed AI works with
metadata, prompts, licensing, provenance notes, local media paths, safe embeds,
and external links for large files.

Reference: <https://astro.build/themes/details/photography-portfolio-template/>

## Local Development

```bash
pnpm install
pnpm dev
```

Useful commands:

```bash
pnpm sync:images
pnpm format
pnpm check
pnpm build
pnpm preview
```

## Fast Image Workflow

The low-effort path is:

1. Download an image from ChatGPT, Gemini, or another generator.
2. Copy it into:

```txt
incoming/images/
```

3. Run the site:

```bash
pnpm dev
```

The `sync:images` script runs automatically before `dev`, `check`, and `build`.
It creates:

- optimized images in `public/media/images/auto/`
- thumbnails in `public/media/thumbnails/auto/`
- generated MDX landing pages in `src/content/works/generated/`

Filename tips:

```txt
2026-06-19-lunar-terminal.png
soft-circuit-garden.webp
```

A date prefix becomes the `createdAt` date. The rest of the filename becomes
the title and slug.

Generated MDX files are good enough for publishing as-is. If you edit one by
hand, the importer will preserve your edits while the source image checksum is
unchanged. For a carefully written project note, you can also move/copy the MDX
entry out of `src/content/works/generated/` and maintain it like normal content.

## Manual Content

Works live in:

```txt
src/content/works/
```

Each entry is MDX with frontmatter similar to:

```yaml
title: 'AI Sailing Jersey Concept'
slug: 'ai-sailing-jersey'
description: 'AI-generated concept design.'
type: 'image' # image | video | audio | embed | collection
status: 'published'
createdAt: '2026-06-18'
updatedAt: '2026-06-18'
thumbnail: '/media/thumbnails/example.webp'
thumbnailAlt: 'Short, descriptive alt text.'
heroImage: '/media/images/example.webp'
heroImageAlt: 'Short, descriptive alt text.'
videoUrl: ''
audioUrl: ''
embedUrl: ''
externalUrl: ''
tools:
  - 'ChatGPT'
  - 'Image generation model'
tags:
  - 'ai-art'
  - 'concept-design'
license: 'CC BY-NC 4.0'
featured: true
draft: false
```

Draft entries are filtered out of all published pages.

## Media

Use local repo storage for small and medium assets:

- thumbnails: `public/media/thumbnails/`
- compressed images: `public/media/images/`
- small demo audio/video files: `public/media/audio/`
- metadata in MDX frontmatter

Avoid committing large originals, full-resolution video, or full-length audio.
Use `externalUrl` for large files and `embedUrl` only for providers that allow
iframe embeds. The v1 allowlist renders YouTube embed URLs and Vimeo player URLs.

Do not rely on temporary image links from AI product websites as the canonical
asset. Those links can expire, require login, block hotlinking, or change over
time. Downloading the image and letting this repo optimize it is more reliable
for GitHub Pages.

## Routes

- `/` home and featured records
- `/works/` all published works
- `/works/[slug]/` work detail pages
- `/images/` image works
- `/videos/` video and embed works
- `/audio/` audio works
- `/experiments/` collection/design experiment works
- `/about/` local workflow notes
- `/404` custom not found page

## GitHub Pages

The Astro config is set for a GitHub Pages project site:

```ts
export default defineConfig({
  site: 'https://cmwen.github.io',
  base: '/ai-portfolio/',
});
```

Before the first deploy, set the repository Pages source to **GitHub Actions**.

Workflows:

- `.github/workflows/ci.yml` runs on pull requests: install, format check,
  `astro check`, and production build.
- `.github/workflows/deploy.yml` runs on pushes to `main`: build with the
  official Astro action and deploy with the official GitHub Pages action.

## Automation Notes

- `scripts/sync-images.mjs` is intentionally deterministic and local.
- Each imported image gets a SHA-256 checksum in generated frontmatter.
- The default generated metadata is deliberately plain so publishing does not
  require a writing session.
- Richer future automation could add model/tool metadata, better alt text, or
  prompt manifests when those are available.
