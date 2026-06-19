import { getCollection, type CollectionEntry } from 'astro:content';

export type Work = CollectionEntry<'works'>;
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

export function isEmbeddable(url: string) {
  if (!url) return false;

  try {
    const parsed = new URL(url);
    return (
      parsed.hostname === 'www.youtube.com' ||
      parsed.hostname === 'youtube.com' ||
      parsed.hostname === 'player.vimeo.com'
    );
  } catch {
    return false;
  }
}
