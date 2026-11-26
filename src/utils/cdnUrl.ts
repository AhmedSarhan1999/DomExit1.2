/**
 * Optional CDN URL resolver for public static media and assets.
 * When VITE_CDN_BASE_URL is unset/empty, returns the path unchanged.
 */
const CDN_BASE = String(import.meta.env.VITE_CDN_BASE_URL || '')
  .trim()
  .replace(/\/+$/, '');

export function resolveCdnUrl(pathOrUrl?: string | null): string {
  const raw = String(pathOrUrl || '').trim();
  if (!raw || !CDN_BASE) return raw;

  if (/^https?:\/\//i.test(raw)) {
    // Optionally rewrite direct Yandex Object Storage public bucket URLs when CDN is enabled
    const publicBucketMatch = raw.match(
      /^https:\/\/storage\.yandexcloud\.net\/domexit-(?:storage-vault|public-photos-staging)\/(.+)$/i
    );
    if (publicBucketMatch) {
      return `${CDN_BASE}/${publicBucketMatch[1].replace(/^\/+/, '')}`;
    }
    return raw;
  }

  const normalizedPath = raw.startsWith('/') ? raw : `/${raw}`;
  return `${CDN_BASE}${normalizedPath}`;
}
