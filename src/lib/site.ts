export const site = {
  title: 'AI Portfolio',
  description:
    'A lightweight side portfolio for AI-built images, experiments, and progress notes by Min Wen.',
  owner: 'Min Wen',
  url: 'https://cmwen.github.io/ai-portfolio/',
  mainBlogUrl: 'https://cmwen.github.io/',
  nav: [
    { href: '/', label: 'Gallery' },
    { href: '/images/', label: 'Images' },
    { href: '/experiments/', label: 'Experiments' },
    { href: '/upload/', label: 'Upload' },
    { href: 'https://cmwen.github.io/', label: 'Blog' },
    { href: 'https://cmwen.github.io/posts/', label: 'Posts' },
    { href: 'https://cmwen.github.io/about/', label: 'About' },
  ],
};

export function withBase(path: string) {
  if (/^(https?:)?\/\//.test(path) || path.startsWith('mailto:')) {
    return path;
  }

  const cleanPath = path.replace(/^\/+/, '');
  return `${import.meta.env.BASE_URL}${cleanPath}`;
}
