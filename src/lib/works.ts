import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'works'>;
export type WorkPage = Work['data']['page'];
export type WorkType = Work['data']['type'];

export async function getAllWorks() {
  const works = await getCollection('works', ({ data }) => {
    return data.status === 'published' && !data.draft;
  });

  return works.sort(
    (a, b) => b.data.createdAt.getTime() - a.data.createdAt.getTime(),
  );
}

export async function getFeaturedWorks() {
  const works = await getAllWorks();
  return works.filter((work) => work.data.featured).slice(0, 6);
}

export async function getWorksByType(types: WorkType[]) {
  const works = await getAllWorks();
  return works.filter((work) => types.includes(work.data.type));
}

export async function getWorksByPage(page: WorkPage) {
  const works = await getAllWorks();
  return works.filter((work) => work.data.page === page);
}

export function getWorkPath(work: Work) {
  return `/works/${work.data.slug}/`;
}

export function formatDate(date: Date) {
  return new Intl.DateTimeFormat('en', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

export function labelForType(type: WorkType) {
  const labels: Record<WorkType, string> = {
    audio: 'Audio',
    collection: 'Collection',
    embed: 'Embed',
    image: 'Image',
    video: 'Video',
  };

  return labels[type];
}

export function labelForPage(page: WorkPage) {
  const labels: Record<WorkPage, string> = {
    content: 'Content',
    design: 'Design',
  };

  return labels[page];
}

export function labelForCategory(category: string) {
  return titleize(category);
}

export function isEmbeddable(url: string) {
  return Boolean(getEmbedUrl(url));
}

export function getEmbedUrl(url: string) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const youtubeId = getYouTubeId(parsed);

    if (youtubeId) return `https://www.youtube.com/embed/${youtubeId}`;
    if (parsed.hostname === 'player.vimeo.com') return parsed.toString();

    return '';
  } catch {
    return '';
  }
}

function getYouTubeId(parsed: URL) {
  if (parsed.hostname === 'youtu.be') {
    return parsed.pathname.replace(/^\/+/, '').split('/')[0];
  }

  if (
    parsed.hostname !== 'www.youtube.com' &&
    parsed.hostname !== 'youtube.com'
  ) {
    return '';
  }

  if (parsed.pathname.startsWith('/embed/')) {
    return parsed.pathname.split('/').filter(Boolean)[1] ?? '';
  }

  if (parsed.pathname.startsWith('/shorts/')) {
    return parsed.pathname.split('/').filter(Boolean)[1] ?? '';
  }

  return parsed.searchParams.get('v') ?? '';
}

function titleize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
