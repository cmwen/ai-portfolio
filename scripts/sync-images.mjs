import { createHash } from 'node:crypto';
import { mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const generatedContentDir = path.join(root, 'src/content/works/generated');
const imageOutDir = path.join(root, 'public/media/images/auto');
const thumbOutDir = path.join(root, 'public/media/thumbnails/auto');
const sourceExtensions = new Set([
  '.avif',
  '.gif',
  '.jpeg',
  '.jpg',
  '.png',
  '.tif',
  '.tiff',
  '.webp',
]);
const allowedTypes = new Set([
  'audio',
  'collection',
  'embed',
  'image',
  'video',
]);
const incomingImageSources = [
  {
    dir: path.join(root, 'incoming/designs/images'),
    sourcePrefix: 'incoming/designs/images',
    page: 'design',
    category: 'image',
  },
  {
    dir: path.join(root, 'incoming/contents/images'),
    sourcePrefix: 'incoming/contents/images',
    page: 'content',
    category: 'poster',
  },
  {
    dir: path.join(root, 'incoming/images'),
    sourcePrefix: 'incoming/images',
    page: 'design',
    category: 'image',
  },
];
const incomingManifestSources = [
  {
    dir: path.join(root, 'incoming/contents/videos'),
    sourcePrefix: 'incoming/contents/videos',
    page: 'content',
    category: 'video',
  },
  {
    dir: path.join(root, 'incoming/contents/embeds'),
    sourcePrefix: 'incoming/contents/embeds',
    page: 'content',
    category: 'embed',
  },
];

await Promise.all([
  mkdir(generatedContentDir, { recursive: true }),
  mkdir(imageOutDir, { recursive: true }),
  mkdir(thumbOutDir, { recursive: true }),
  ...incomingImageSources.map((source) =>
    mkdir(source.dir, { recursive: true }),
  ),
  ...incomingManifestSources.map((source) =>
    mkdir(source.dir, { recursive: true }),
  ),
]);

let imported = 0;

for (const source of incomingImageSources) {
  imported += await syncImageSource(source);
}

for (const source of incomingManifestSources) {
  imported += await syncManifestSource(source);
}

if (imported === 0) {
  console.log('No incoming images or manifests found.');
  process.exit(0);
}

console.log(`Synced ${imported} incoming item${imported === 1 ? '' : 's'}.`);

async function syncImageSource(source) {
  const files = (await readdir(source.dir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => sourceExtensions.has(path.extname(name).toLowerCase()))
    .sort((a, b) => a.localeCompare(b));

  let count = 0;

  for (const file of files) {
    const sourcePath = path.join(source.dir, file);
    const imageBuffer = await readFile(sourcePath);
    const metadata = await readSidecar(source.dir, file);
    const checksum = createHash('sha256')
      .update(imageBuffer)
      .update(JSON.stringify(metadata))
      .digest('hex');
    const sourceStat = await stat(sourcePath);
    const parsed = parseSourceName(file, metadata);
    const slug = parsed.slug;
    const date =
      parsed.date || dateFromMetadata(metadata) || toDateOnly(sourceStat.mtime);
    const updatedAt = toDateOnly(sourceStat.mtime);
    const title = parsed.title;
    const description =
      cleanString(metadata.description) ||
      `AI-generated ${metadata.category ?? source.category} imported from ${file}.`;
    const fullImagePath = path.join(imageOutDir, `${slug}.webp`);
    const thumbPath = path.join(thumbOutDir, `${slug}.webp`);
    const contentPath = path.join(generatedContentDir, `${slug}.mdx`);
    const youtube = normalizeYouTubeUrl(metadata.youtubeUrl);
    const workType = inferType(metadata.type, youtube);

    await sharp(sourcePath)
      .rotate()
      .resize({ width: 1800, withoutEnlargement: true })
      .webp({ quality: 84 })
      .toFile(fullImagePath);

    await sharp(sourcePath)
      .rotate()
      .resize({
        width: 900,
        height: 675,
        fit: 'cover',
        withoutEnlargement: true,
      })
      .webp({ quality: 78 })
      .toFile(thumbPath);

    if (await shouldWriteMdx(contentPath, checksum)) {
      await writeFile(
        contentPath,
        makeMdx({
          title,
          slug,
          description,
          page: validPage(metadata.page, source.page),
          category: cleanString(metadata.category) || source.category,
          type: workType,
          date,
          updatedAt,
          thumbnail: `/media/thumbnails/auto/${slug}.webp`,
          thumbnailAlt: `AI-generated ${title}.`,
          heroImage: `/media/images/auto/${slug}.webp`,
          heroImageAlt: `AI-generated ${title}.`,
          aiTool: cleanString(metadata.aiTool),
          tools: normalizeList(metadata.tools, metadata.aiTool),
          tags: normalizeTags(
            metadata.tags,
            metadata.category ?? source.category,
          ),
          embedUrl: youtube ? youtube.embedUrl : '',
          externalUrl: youtube
            ? youtube.watchUrl
            : cleanString(metadata.externalUrl),
          source: `${source.sourcePrefix}/${file}`,
          notes: `Generated by scripts/sync-images.mjs from ${source.sourcePrefix}.`,
          checksum,
        }),
      );
    }

    count += 1;
  }

  return count;
}

async function syncManifestSource(source) {
  const files = (await readdir(source.dir, { withFileTypes: true }))
    .filter((entry) => entry.isFile())
    .map((entry) => entry.name)
    .filter((name) => path.extname(name).toLowerCase() === '.json')
    .sort((a, b) => a.localeCompare(b));

  let count = 0;

  for (const file of files) {
    const sourcePath = path.join(source.dir, file);
    const raw = await readFile(sourcePath, 'utf8');
    const metadata = parseJson(raw, sourcePath);
    const sourceStat = await stat(sourcePath);
    const checksum = createHash('sha256').update(raw).digest('hex');
    const parsed = parseSourceName(file, metadata);
    const slug = parsed.slug;
    const date =
      parsed.date || dateFromMetadata(metadata) || toDateOnly(sourceStat.mtime);
    const updatedAt = toDateOnly(sourceStat.mtime);
    const title = parsed.title;
    const youtube = normalizeYouTubeUrl(
      metadata.youtubeUrl ?? metadata.externalUrl,
    );
    const thumbnail =
      cleanString(metadata.thumbnail) || youtube?.thumbnailUrl || '';
    const contentPath = path.join(generatedContentDir, `${slug}.mdx`);

    if (!thumbnail) {
      throw new Error(
        `${source.sourcePrefix}/${file} needs a thumbnail or YouTube URL.`,
      );
    }

    if (await shouldWriteMdx(contentPath, checksum)) {
      await writeFile(
        contentPath,
        makeMdx({
          title,
          slug,
          description:
            cleanString(metadata.description) ||
            `AI-generated ${metadata.category ?? source.category} hosted externally.`,
          page: validPage(metadata.page, source.page),
          category: cleanString(metadata.category) || source.category,
          type: inferType(metadata.type, youtube),
          date,
          updatedAt,
          thumbnail,
          thumbnailAlt:
            cleanString(metadata.thumbnailAlt) || `Thumbnail for ${title}.`,
          heroImage: cleanString(metadata.heroImage) || thumbnail,
          heroImageAlt:
            cleanString(metadata.heroImageAlt) || `Cover for ${title}.`,
          aiTool: cleanString(metadata.aiTool),
          tools: normalizeList(metadata.tools, metadata.aiTool),
          tags: normalizeTags(
            metadata.tags,
            metadata.category ?? source.category,
          ),
          embedUrl: youtube ? youtube.embedUrl : cleanString(metadata.embedUrl),
          externalUrl: youtube
            ? youtube.watchUrl
            : cleanString(metadata.externalUrl),
          source: `${source.sourcePrefix}/${file}`,
          notes: `Generated by scripts/sync-images.mjs from ${source.sourcePrefix}.`,
          checksum,
        }),
      );
    }

    count += 1;
  }

  return count;
}

async function readSidecar(dir, file) {
  const sidecarPath = path.join(
    dir,
    `${path.basename(file, path.extname(file))}.json`,
  );

  try {
    return parseJson(await readFile(sidecarPath, 'utf8'), sidecarPath);
  } catch (error) {
    if (error?.code === 'ENOENT') return {};
    throw error;
  }
}

function parseJson(raw, sourcePath) {
  try {
    return JSON.parse(raw);
  } catch (error) {
    throw new Error(`Could not parse ${sourcePath}: ${error.message}`);
  }
}

function parseSourceName(file, metadata = {}) {
  const extension = path.extname(file);
  const base = path.basename(file, extension);
  const rawTitle = cleanString(metadata.title);
  const dateMatch = base.match(/^(\d{4}-\d{2}-\d{2})[-_\s]+(.+)$/);
  const date = dateMatch?.[1];
  const nameWithoutDate = dateMatch?.[2] ?? base;
  const slug = slugify(rawTitle || nameWithoutDate) || slugify(base);
  const title = rawTitle || titleize(nameWithoutDate);

  return { date, slug, title };
}

function inferType(type, youtube) {
  if (typeof type === 'string' && allowedTypes.has(type)) return type;
  if (youtube) return 'embed';
  return 'image';
}

function validPage(page, fallback) {
  return page === 'content' || page === 'design' ? page : fallback;
}

function dateFromMetadata(metadata) {
  const raw = metadata.createdAt ?? metadata.uploadedAt;
  if (!raw) return '';
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? '' : toDateOnly(date);
}

function normalizeYouTubeUrl(value) {
  const raw = cleanString(value);
  if (!raw) return null;

  try {
    const parsed = new URL(raw);
    let videoId = '';

    if (parsed.hostname === 'youtu.be') {
      videoId = parsed.pathname.replace(/^\/+/, '').split('/')[0];
    } else if (
      parsed.hostname === 'www.youtube.com' ||
      parsed.hostname === 'youtube.com'
    ) {
      if (parsed.pathname.startsWith('/embed/')) {
        videoId = parsed.pathname.split('/').filter(Boolean)[1] ?? '';
      } else if (parsed.pathname.startsWith('/shorts/')) {
        videoId = parsed.pathname.split('/').filter(Boolean)[1] ?? '';
      } else {
        videoId = parsed.searchParams.get('v') ?? '';
      }
    }

    if (!/^[a-zA-Z0-9_-]{6,}$/.test(videoId)) return null;

    return {
      embedUrl: `https://www.youtube.com/embed/${videoId}`,
      thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`,
      watchUrl: `https://www.youtube.com/watch?v=${videoId}`,
    };
  } catch {
    return null;
  }
}

function normalizeList(values, fallback) {
  const list = Array.isArray(values) ? values : [];
  const normalized = list.map((value) => cleanString(value)).filter(Boolean);
  const fallbackValue = cleanString(fallback);

  if (fallbackValue) normalized.unshift(fallbackValue);

  return Array.from(new Set(normalized));
}

function normalizeTags(values, category) {
  const tags = Array.isArray(values) ? values : [];
  return Array.from(
    new Set([
      'ai-generated',
      cleanString(category),
      ...tags.map((value) => cleanString(value)),
    ]),
  ).filter(Boolean);
}

function slugify(value) {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function titleize(value) {
  const cleaned = value.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim();

  if (!cleaned) return 'Untitled AI Work';

  return cleaned.replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function toDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function cleanString(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function yamlString(value) {
  return `'${String(value).replace(/'/g, "''")}'`;
}

function yamlList(values) {
  if (values.length === 0) return '[]';
  return values.map((value) => `  - ${yamlString(value)}`).join('\n');
}

function yamlListField(name, values) {
  if (values.length === 0) return `${name}: []`;
  return `${name}:\n${yamlList(values)}`;
}

async function shouldWriteMdx(contentPath, checksum) {
  try {
    const existing = await readFile(contentPath, 'utf8');
    const hasLegacyEmptyList = /\n(?:tools|tags):\n\[\]\n/.test(existing);
    const hasBlankCreatedAt = /\ncreatedAt: ''\n/.test(existing);
    return (
      !existing.includes(`sha256: '${checksum}'`) ||
      hasLegacyEmptyList ||
      hasBlankCreatedAt
    );
  } catch {
    return true;
  }
}

function makeMdx({
  title,
  slug,
  description,
  page,
  category,
  type,
  date,
  updatedAt,
  thumbnail,
  thumbnailAlt,
  heroImage,
  heroImageAlt,
  aiTool,
  tools,
  tags,
  embedUrl,
  externalUrl,
  source,
  notes,
  checksum,
}) {
  return `---
title: ${yamlString(title)}
slug: ${yamlString(slug)}
description: ${yamlString(description)}
page: ${yamlString(page)}
category: ${yamlString(category)}
type: ${yamlString(type)}
status: 'published'
createdAt: '${date}'
updatedAt: '${updatedAt}'
thumbnail: ${yamlString(thumbnail)}
thumbnailAlt: ${yamlString(thumbnailAlt)}
heroImage: ${yamlString(heroImage)}
heroImageAlt: ${yamlString(heroImageAlt)}
embedUrl: ${yamlString(embedUrl)}
externalUrl: ${yamlString(externalUrl)}
aiTool: ${yamlString(aiTool)}
${yamlListField('tools', tools)}
${yamlListField('tags', tags)}
license: 'CC BY-NC 4.0'
featured: false
draft: false
provenance:
  source: ${yamlString(source)}
  notes: ${yamlString(notes)}
  sha256: '${checksum}'
---

This entry was generated from \`${source}\`.

Add notes here only if this artifact grows into a fuller project record.
`;
}
