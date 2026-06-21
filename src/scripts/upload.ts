import { encode } from '@jsquash/webp';

type UploadSettings = {
  owner: string;
  repo: string;
  branch: string;
  directory: string;
  token: string;
};

type UploadPage = 'design' | 'content';

type ContentMetadata = {
  page: UploadPage;
  category: string;
  title: string;
  description: string;
  aiTool: string;
  tags: string[];
  youtubeUrl: string;
};

type PreparedImage = {
  sourceName: string;
  outputName: string;
  blob: Blob;
  width: number;
  height: number;
  originalBytes: number;
  outputBytes: number;
  previewUrl: string;
};

type SharePayload = {
  title?: string;
  text?: string;
  url?: string;
  files?: File[];
  receivedAt?: string;
};

const storageKeys = {
  owner: 'aiPortfolio.githubOwner',
  repo: 'aiPortfolio.githubRepo',
  branch: 'aiPortfolio.githubBranch',
  directory: 'aiPortfolio.githubDirectory',
  token: 'aiPortfolio.githubToken',
  page: 'aiPortfolio.uploadPage',
  category: 'aiPortfolio.uploadCategory',
  aiTool: 'aiPortfolio.aiTool',
  aiToolManual: 'aiPortfolio.aiToolManual',
  tags: 'aiPortfolio.uploadTags',
};

const shareDb = {
  name: 'ai-portfolio-share',
  version: 1,
  store: 'shares',
  key: 'latest',
};

const defaults = {
  owner: 'cmwen',
  repo: 'ai-portfolio',
  branch: 'main',
  directory: 'incoming/designs/images',
  page: 'design' as UploadPage,
  category: 'image',
  aiTool: 'ChatGPT',
};

const directoryByPage: Record<UploadPage, string> = {
  content: 'incoming/contents/images',
  design: 'incoming/designs/images',
};

const categoriesByPage: Record<UploadPage, string[]> = {
  content: ['poster', 'comic', 'video', 'audio', 'embed', 'article', 'other'],
  design: [
    'icon',
    'image',
    'ux',
    'identity',
    'collection',
    'prototype',
    'other',
  ],
};

const maxWidth = 1800;
const webpQuality = 84;

const form = document.querySelector<HTMLFormElement>('[data-upload-form]');
const fileInput = document.querySelector<HTMLInputElement>('[data-file-input]');
const dropzone = document.querySelector<HTMLElement>('[data-dropzone]');
const tokenInput = document.querySelector<HTMLInputElement>('[data-token]');
const ownerInput = document.querySelector<HTMLInputElement>('[data-owner]');
const repoInput = document.querySelector<HTMLInputElement>('[data-repo]');
const branchInput = document.querySelector<HTMLInputElement>('[data-branch]');
const directoryInput =
  document.querySelector<HTMLInputElement>('[data-directory]');
const pageInputs = Array.from(
  document.querySelectorAll<HTMLInputElement>('[data-page]'),
);
const categoryInput =
  document.querySelector<HTMLSelectElement>('[data-category]');
const aiToolInput = document.querySelector<HTMLSelectElement>('[data-ai-tool]');
const aiToolManualWrap = document.querySelector<HTMLElement>(
  '[data-ai-tool-manual-wrap]',
);
const aiToolManualInput = document.querySelector<HTMLInputElement>(
  '[data-ai-tool-manual]',
);
const titleInput = document.querySelector<HTMLInputElement>('[data-title]');
const descriptionInput =
  document.querySelector<HTMLTextAreaElement>('[data-description]');
const tagsInput = document.querySelector<HTMLInputElement>('[data-tags]');
const youtubeUrlInput =
  document.querySelector<HTMLInputElement>('[data-youtube-url]');
const saveSettingsButton = document.querySelector<HTMLButtonElement>(
  '[data-save-settings]',
);
const clearTokenButton =
  document.querySelector<HTMLButtonElement>('[data-clear-token]');
const prepareButton =
  document.querySelector<HTMLButtonElement>('[data-prepare]');
const uploadButton = document.querySelector<HTMLButtonElement>('[data-upload]');
const statusEl = document.querySelector<HTMLElement>('[data-status]');
const listEl = document.querySelector<HTMLElement>('[data-prepared-list]');
const sharedNotice = document.querySelector<HTMLElement>(
  '[data-shared-notice]',
);
const installState = document.querySelector<HTMLElement>(
  '[data-install-state]',
);

const preparedImages: PreparedImage[] = [];

hydrateSettings();
registerUiEvents();
loadSharedFiles();
setInstallState();

function registerUiEvents() {
  saveSettingsButton?.addEventListener('click', () => {
    const settings = readSettings();
    const metadata = readContentMetadata();
    localStorage.setItem(storageKeys.owner, settings.owner);
    localStorage.setItem(storageKeys.repo, settings.repo);
    localStorage.setItem(storageKeys.branch, settings.branch);
    localStorage.setItem(storageKeys.directory, settings.directory);
    localStorage.setItem(storageKeys.token, settings.token);
    localStorage.setItem(storageKeys.page, metadata.page);
    localStorage.setItem(storageKeys.category, metadata.category);
    localStorage.setItem(
      storageKeys.aiTool,
      aiToolInput?.value ?? defaults.aiTool,
    );
    localStorage.setItem(
      storageKeys.aiToolManual,
      aiToolManualInput?.value.trim() ?? '',
    );
    localStorage.setItem(storageKeys.tags, tagsInput?.value.trim() ?? '');
    setStatus('Settings saved in this browser.', 'ok');
  });

  clearTokenButton?.addEventListener('click', () => {
    localStorage.removeItem(storageKeys.token);
    if (tokenInput) tokenInput.value = '';
    setStatus('Token removed from local storage.', 'ok');
  });

  prepareButton?.addEventListener('click', async () => {
    await prepareFiles(Array.from(fileInput?.files ?? []));
  });

  uploadButton?.addEventListener('click', async () => {
    await uploadPreparedImages();
  });

  form?.addEventListener('submit', (event) => {
    event.preventDefault();
  });

  fileInput?.addEventListener('change', async () => {
    await prepareFiles(Array.from(fileInput.files ?? []));
  });

  dropzone?.addEventListener('dragover', (event) => {
    event.preventDefault();
    dropzone.classList.add('border-[var(--accent)]');
  });

  dropzone?.addEventListener('dragleave', () => {
    dropzone.classList.remove('border-[var(--accent)]');
  });

  dropzone?.addEventListener('drop', async (event) => {
    event.preventDefault();
    dropzone.classList.remove('border-[var(--accent)]');
    await prepareFiles(Array.from(event.dataTransfer?.files ?? []));
  });

  for (const pageInput of pageInputs) {
    pageInput.addEventListener('change', () => {
      if (!pageInput.checked) return;
      updateCategoryOptions(pageInput.value as UploadPage);
      updateSelectedPageCards();
      syncDirectoryForPage(pageInput.value as UploadPage);
    });
  }

  aiToolInput?.addEventListener('change', updateManualToolVisibility);
}

function hydrateSettings() {
  const page = readStoredPage();
  setPage(page);
  updateCategoryOptions(page);
  updateSelectedPageCards();

  if (categoryInput) {
    const storedCategory =
      localStorage.getItem(storageKeys.category) ?? defaults.category;
    categoryInput.value = categoriesByPage[page].includes(storedCategory)
      ? storedCategory
      : categoriesByPage[page][0];
  }

  if (aiToolInput) {
    aiToolInput.value =
      localStorage.getItem(storageKeys.aiTool) ?? defaults.aiTool;
  }
  if (aiToolManualInput) {
    aiToolManualInput.value =
      localStorage.getItem(storageKeys.aiToolManual) ?? '';
  }
  if (tagsInput) tagsInput.value = localStorage.getItem(storageKeys.tags) ?? '';

  if (ownerInput)
    ownerInput.value =
      localStorage.getItem(storageKeys.owner) ?? defaults.owner;
  if (repoInput)
    repoInput.value = localStorage.getItem(storageKeys.repo) ?? defaults.repo;
  if (branchInput)
    branchInput.value =
      localStorage.getItem(storageKeys.branch) ?? defaults.branch;
  if (directoryInput) {
    directoryInput.value =
      localStorage.getItem(storageKeys.directory) ?? directoryByPage[page];
  }
  if (tokenInput)
    tokenInput.value = localStorage.getItem(storageKeys.token) ?? '';

  updateManualToolVisibility();
}

async function prepareFiles(files: File[]) {
  const imageFiles = files.filter(isImageFile);

  if (imageFiles.length === 0) {
    setStatus('Choose or share at least one image file.', 'error');
    return;
  }

  setBusy(true);
  setStatus('Cleaning metadata and encoding WebP with WASM...', 'loading');

  for (const image of preparedImages.splice(0)) {
    URL.revokeObjectURL(image.previewUrl);
  }

  try {
    for (const file of imageFiles) {
      preparedImages.push(await transformImage(file));
      renderPreparedImages();
    }

    setStatus(
      `Prepared ${preparedImages.length} cleaned WebP ${
        preparedImages.length === 1 ? 'image' : 'images'
      }.`,
      'ok',
    );
  } catch (error) {
    setStatus(getErrorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function transformImage(file: File): Promise<PreparedImage> {
  const bitmap = await decodeBitmap(file);
  const scale = Math.min(1, maxWidth / bitmap.width);
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const imageData = drawToImageData(bitmap, width, height);
  bitmap.close?.();

  const encoded = await encode(imageData, {
    quality: webpQuality,
    method: 4,
    alpha_quality: 90,
  });
  const blob = new Blob([encoded], { type: 'image/webp' });
  const outputName = `${timestampSlug()}-${slugify(file.name)}.webp`;

  return {
    sourceName: file.name,
    outputName,
    blob,
    width,
    height,
    originalBytes: file.size,
    outputBytes: blob.size,
    previewUrl: URL.createObjectURL(blob),
  };
}

async function decodeBitmap(file: File) {
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    return await decodeBitmapWithImageElement(file);
  }
}

async function decodeBitmapWithImageElement(file: File) {
  const imageUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () =>
        reject(new Error(`Could not decode ${file.name}.`));
      element.src = imageUrl;
    });

    return await createImageBitmap(image);
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

function drawToImageData(bitmap: ImageBitmap, width: number, height: number) {
  if ('OffscreenCanvas' in window) {
    const canvas = new OffscreenCanvas(width, height);
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) throw new Error('Canvas rendering is unavailable.');
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d', { alpha: true });
  if (!context) throw new Error('Canvas rendering is unavailable.');
  context.drawImage(bitmap, 0, 0, width, height);
  return context.getImageData(0, 0, width, height);
}

async function uploadPreparedImages() {
  if (preparedImages.length === 0) {
    setStatus('Prepare an image before uploading.', 'error');
    return;
  }

  const settings = readSettings();
  const metadata = readContentMetadata();

  if (!settings.token) {
    setStatus(
      'Add a fine-grained GitHub token with Contents write access.',
      'error',
    );
    return;
  }

  setBusy(true);

  try {
    localStorage.setItem(storageKeys.owner, settings.owner);
    localStorage.setItem(storageKeys.repo, settings.repo);
    localStorage.setItem(storageKeys.branch, settings.branch);
    localStorage.setItem(storageKeys.directory, settings.directory);
    localStorage.setItem(storageKeys.token, settings.token);
    localStorage.setItem(storageKeys.page, metadata.page);
    localStorage.setItem(storageKeys.category, metadata.category);
    localStorage.setItem(storageKeys.aiTool, aiToolInput?.value ?? '');
    localStorage.setItem(
      storageKeys.aiToolManual,
      aiToolManualInput?.value.trim() ?? '',
    );
    localStorage.setItem(storageKeys.tags, tagsInput?.value.trim() ?? '');

    const createdUrls: string[] = [];

    for (const image of preparedImages) {
      setStatus(`Uploading ${image.outputName}...`, 'loading');
      const response = await putFile(settings, image);
      createdUrls.push(response.content?.html_url ?? response.commit?.html_url);

      setStatus(`Uploading metadata for ${image.outputName}...`, 'loading');
      const metadataResponse = await putMetadataFile(settings, image, metadata);
      createdUrls.push(
        metadataResponse.content?.html_url ?? metadataResponse.commit?.html_url,
      );
    }

    renderLinks(createdUrls.filter(Boolean));
    setStatus(
      `Uploaded ${preparedImages.length} image${
        preparedImages.length === 1 ? '' : 's'
      }. GitHub Actions will publish the processed gallery next.`,
      'ok',
    );
  } catch (error) {
    setStatus(getErrorMessage(error), 'error');
  } finally {
    setBusy(false);
  }
}

async function putFile(settings: UploadSettings, image: PreparedImage) {
  const path = `${trimSlashes(settings.directory)}/${image.outputName}`;
  const content = await blobToBase64(image.blob);

  return putBase64File({
    settings,
    path,
    content,
    message: `Add uploaded image ${image.outputName}`,
  });
}

async function putMetadataFile(
  settings: UploadSettings,
  image: PreparedImage,
  metadata: ContentMetadata,
) {
  const path = `${trimSlashes(settings.directory)}/${metadataFileName(
    image.outputName,
  )}`;
  const payload = {
    version: 1,
    page: metadata.page,
    category: metadata.category,
    title: metadata.title,
    description: metadata.description,
    type: metadata.youtubeUrl ? 'embed' : 'image',
    aiTool: metadata.aiTool,
    tools: metadata.aiTool ? [metadata.aiTool] : [],
    tags: Array.from(
      new Set(['ai-generated', metadata.category, ...metadata.tags]),
    ),
    youtubeUrl: metadata.youtubeUrl,
    sourceName: image.sourceName,
    outputName: image.outputName,
    uploadedAt: new Date().toISOString(),
    width: image.width,
    height: image.height,
  };
  const content = textToBase64(`${JSON.stringify(payload, null, 2)}\n`);

  return putBase64File({
    settings,
    path,
    content,
    message: `Add upload metadata for ${image.outputName}`,
  });
}

async function putBase64File({
  settings,
  path,
  content,
  message,
}: {
  settings: UploadSettings;
  path: string;
  content: string;
  message: string;
}) {
  const endpoint = `https://api.github.com/repos/${encodeURIComponent(
    settings.owner,
  )}/${encodeURIComponent(settings.repo)}/contents/${path
    .split('/')
    .map(encodeURIComponent)
    .join('/')}`;
  const response = await fetch(endpoint, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${settings.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      branch: settings.branch,
      message,
      content,
    }),
  });

  const body = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      body.message ??
        `GitHub upload failed with ${response.status} ${response.statusText}.`,
    );
  }

  return body;
}

async function blobToBase64(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function textToBase64(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = '';
  const chunkSize = 0x8000;

  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }

  return btoa(binary);
}

function readSettings(): UploadSettings {
  return {
    owner: cleanInput(ownerInput?.value) || defaults.owner,
    repo: cleanInput(repoInput?.value) || defaults.repo,
    branch: cleanInput(branchInput?.value) || defaults.branch,
    directory: trimSlashes(
      cleanInput(directoryInput?.value) || defaults.directory,
    ),
    token: tokenInput?.value.trim() ?? '',
  };
}

function readContentMetadata(): ContentMetadata {
  const page = readSelectedPage();
  const category =
    cleanInput(categoryInput?.value) || categoriesByPage[page][0];
  const aiTool = readAiTool();

  return {
    page,
    category,
    title: cleanInput(titleInput?.value),
    description: cleanInput(descriptionInput?.value),
    aiTool,
    tags: parseTags(tagsInput?.value ?? ''),
    youtubeUrl: normalizeYouTubeUrl(cleanInput(youtubeUrlInput?.value)),
  };
}

async function loadSharedFiles() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('shared')) return;

  try {
    const payload = await readLatestShare();
    const files = payload?.files ?? [];

    if (files.length > 0) {
      sharedNotice?.classList.remove('hidden');
      await prepareFiles(files);
    } else {
      setStatus(
        'The share target opened, but no image file was received.',
        'error',
      );
    }
  } catch (error) {
    setStatus(getErrorMessage(error), 'error');
  }
}

async function readLatestShare(): Promise<SharePayload | null> {
  const db = await openShareDb();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(shareDb.store, 'readonly');
    const request = transaction.objectStore(shareDb.store).get(shareDb.key);

    request.onsuccess = () => resolve(request.result ?? null);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => db.close();
  });
}

function openShareDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(shareDb.name, shareDb.version);

    request.onupgradeneeded = () => {
      request.result.createObjectStore(shareDb.store);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function renderPreparedImages() {
  if (!listEl) return;

  listEl.innerHTML = preparedImages
    .map(
      (image) => `
        <article class="grid gap-4 rounded-lg border border-[var(--line)] bg-[var(--surface)] p-4 sm:grid-cols-[9rem_1fr]">
          <img class="aspect-[4/3] h-full w-full rounded-md object-cover" src="${image.previewUrl}" alt="">
          <div class="min-w-0">
            <h3 class="truncate text-base font-semibold">${escapeHtml(image.outputName)}</h3>
            <p class="mt-2 text-sm text-[var(--muted)]">${escapeHtml(image.sourceName)}</p>
            <p class="mt-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent-ink)]">${escapeHtml(
              previewMetadataLabel(),
            )}</p>
            <dl class="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt class="text-[var(--muted)]">Output</dt>
                <dd class="font-medium">${formatBytes(image.outputBytes)}</dd>
              </div>
              <div>
                <dt class="text-[var(--muted)]">Original</dt>
                <dd class="font-medium">${formatBytes(image.originalBytes)}</dd>
              </div>
              <div>
                <dt class="text-[var(--muted)]">Size</dt>
                <dd class="font-medium">${image.width} x ${image.height}</dd>
              </div>
              <div>
                <dt class="text-[var(--muted)]">Format</dt>
                <dd class="font-medium">WebP, EXIF stripped</dd>
              </div>
            </dl>
          </div>
        </article>
      `,
    )
    .join('');
}

function renderLinks(urls: string[]) {
  if (!listEl || urls.length === 0) return;

  const links = urls
    .map(
      (url) =>
        `<a class="focus-ring inline-flex rounded-full border border-[var(--line)] px-3 py-2 text-sm font-medium text-[var(--accent-ink)]" href="${escapeAttribute(
          url,
        )}" target="_blank" rel="noreferrer">View committed file</a>`,
    )
    .join('');

  listEl.insertAdjacentHTML(
    'beforeend',
    `<div class="flex flex-wrap gap-2">${links}</div>`,
  );
}

function setBusy(isBusy: boolean) {
  if (prepareButton) prepareButton.disabled = isBusy;
  if (uploadButton) uploadButton.disabled = isBusy;
}

function setPage(page: UploadPage) {
  for (const input of pageInputs) {
    input.checked = input.value === page;
  }
}

function readStoredPage(): UploadPage {
  const stored = localStorage.getItem(storageKeys.page);
  return stored === 'content' || stored === 'design' ? stored : defaults.page;
}

function readSelectedPage(): UploadPage {
  const checked = pageInputs.find((input) => input.checked);
  return checked?.value === 'content' ? 'content' : 'design';
}

function updateCategoryOptions(page: UploadPage) {
  if (!categoryInput) return;

  const current =
    categoryInput.value || localStorage.getItem(storageKeys.category);
  categoryInput.innerHTML = categoriesByPage[page]
    .map(
      (category) =>
        `<option value="${escapeAttribute(category)}">${escapeHtml(
          titleize(category),
        )}</option>`,
    )
    .join('');
  categoryInput.value =
    current && categoriesByPage[page].includes(current)
      ? current
      : categoriesByPage[page][0];
}

function updateSelectedPageCards() {
  for (const input of pageInputs) {
    input
      .closest('label')
      ?.setAttribute('data-selected', String(input.checked));
  }
}

function syncDirectoryForPage(page: UploadPage) {
  if (!directoryInput) return;

  const knownDirectories = new Set([
    defaults.directory,
    'incoming/images',
    ...Object.values(directoryByPage),
  ]);
  const current = trimSlashes(directoryInput.value);
  if (!current || knownDirectories.has(current)) {
    directoryInput.value = directoryByPage[page];
  }
}

function updateManualToolVisibility() {
  const isManual = aiToolInput?.value === 'manual';
  aiToolManualWrap?.classList.toggle('hidden', !isManual);
}

function readAiTool() {
  const selected = aiToolInput?.value || defaults.aiTool;

  if (selected === 'manual') {
    return cleanInput(aiToolManualInput?.value);
  }

  return selected;
}

function previewMetadataLabel() {
  const metadata = readContentMetadata();
  const tool = metadata.aiTool ? ` / ${metadata.aiTool}` : '';
  return `${metadata.page} / ${metadata.category}${tool}`;
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);
}

function normalizeYouTubeUrl(value: string) {
  if (!value) return '';

  try {
    const parsed = new URL(value);
    if (
      parsed.hostname === 'youtu.be' ||
      parsed.hostname.endsWith('youtube.com')
    ) {
      return parsed.toString();
    }
  } catch {
    return '';
  }

  return '';
}

function setStatus(message: string, tone: 'loading' | 'ok' | 'error') {
  if (!statusEl) return;

  statusEl.textContent = message;
  statusEl.dataset.tone = tone;
}

function setInstallState() {
  if (!installState) return;

  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in navigator && Boolean(navigator.standalone));

  installState.textContent = standalone
    ? 'Installed app mode detected.'
    : 'Install this page as a PWA before using mobile share targets.';
}

function timestampSlug() {
  return new Date()
    .toISOString()
    .replace(/\.\d{3}Z$/, '')
    .replace(/[-:T]/g, '')
    .toLowerCase();
}

function slugify(fileName: string) {
  return (
    fileName
      .replace(/\.[^.]+$/, '')
      .normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 72) || 'upload'
  );
}

function cleanInput(value = '') {
  return value.trim();
}

function trimSlashes(value: string) {
  return value.replace(/^\/+|\/+$/g, '');
}

function metadataFileName(outputName: string) {
  return `${outputName.replace(/\.[^.]+$/, '')}.json`;
}

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  const kilobytes = bytes / 1024;
  if (kilobytes < 1024) return `${kilobytes.toFixed(1)} KB`;
  return `${(kilobytes / 1024).toFixed(2)} MB`;
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    if (/decode|bitmap|image/i.test(error.message)) {
      return `${error.message} This browser may not support that source format; export JPEG, PNG, WebP, or AVIF and try again.`;
    }

    return error.message;
  }

  return 'Something went wrong.';
}

function isImageFile(file: File) {
  return (
    file.type.startsWith('image/') ||
    /\.(avif|gif|heic|heif|jpe?g|png|webp)$/i.test(file.name)
  );
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };
    return entities[character];
  });
}

function escapeAttribute(value: string) {
  return escapeHtml(value);
}

function titleize(value: string) {
  return value
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}
