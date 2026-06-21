# AI Portfolio

Static Astro side portfolio for AI-generated designs and content. Long-form
writing, tags, search, and personal context live on the main blog at
<https://cmwen.github.io/>.

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

## Fast Upload Workflow

The low-effort path is:

1. Download an image from ChatGPT, Gemini, or another generator.
2. Open `/upload/`.
3. Choose the destination page:
   - `Designs` for icons, images, UX, identity, prototypes, and collections.
   - `Contents` for posters, comics, videos, audio, embeds, and shareable media.
4. Choose the category and AI tool. ChatGPT and Gemini are built in, and
   "Manual entry" supports any other tool name.
5. Optionally add a title, short description, tags, and a YouTube URL.
6. Upload. The browser commits a cleaned WebP plus a JSON sidecar into one of:

```txt
incoming/designs/images/
incoming/contents/images/
```

The legacy folder still works:

```txt
incoming/images/
```

It imports as a design image when there is no sidecar metadata.

Run the site:

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
the title and slug unless the JSON sidecar provides a title.

Generated MDX files are good enough for publishing as-is. If you edit one by
hand, the importer will preserve your edits while the source image checksum is
unchanged. For a carefully written project note, you can also move/copy the MDX
entry out of `src/content/works/generated/` and maintain it like normal content.

## YouTube Video Workflow

AI-generated video can be hosted on YouTube instead of committed to the repo.
Use one of these paths:

- Upload a cover image through `/upload/`, choose `Contents`, pick `video` or
  `embed`, and paste the YouTube URL. The sidecar makes the generated MDX an
  embed entry.
- For a video-only record with no local cover image, add a JSON manifest to:

```txt
incoming/contents/videos/
```

Example:

```json
{
  "title": "Synthetic Weather Study",
  "description": "AI-generated video hosted on YouTube.",
  "category": "video",
  "aiTool": "Runway",
  "youtubeUrl": "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
  "tags": ["motion-study"]
}
```

The pipeline converts normal YouTube watch, share, shorts, or embed URLs into a
safe iframe URL and uses `https://img.youtube.com/vi/{id}/hqdefault.jpg` as the
thumbnail when no local thumbnail is provided.

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
page: 'design' # design | content
category: 'image'
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
aiTool: 'ChatGPT'
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
iframe embeds. The renderer accepts YouTube watch, share, shorts, and embed URLs
and Vimeo player URLs.

Do not rely on temporary image links from AI product websites as the canonical
asset. Those links can expire, require login, block hotlinking, or change over
time. Downloading the image and letting this repo optimize it is more reliable
for GitHub Pages.

## Routes

- `/` home and featured records
- `/designs/` design collection: icon, image, UX, identity, collection, etc.
- `/contents/` content collection: poster, comic, video, audio, embed, etc.
- `/works/` all published works
- `/works/[slug]/` work detail pages
- `/images/`, `/videos/`, `/audio/`, `/experiments/` legacy media filters
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
- Sidecar JSON supports destination page, category, AI tool, tags, title,
  description, and YouTube URL.
- YouTube manifests in `incoming/contents/videos/` can create embed pages
  without committing full video files.
