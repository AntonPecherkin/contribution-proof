import type { Post } from './providers/types';

const HANDLE_PATTERN = /^[A-Za-z0-9_]{1,15}$/;
const X_HOSTS = new Set(['x.com', 'www.x.com', 'twitter.com', 'www.twitter.com']);

function handleFromUrl(raw: string): string | null {
  const hasProtocol = raw.startsWith('https://') || raw.startsWith('http://');
  const urlText = hasProtocol ? raw : `https://${raw}`;

  try {
    const url = new URL(urlText);
    if (!X_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }

    return url.pathname.split('/').filter(Boolean)[0] ?? null;
  } catch {
    return null;
  }
}

export function normalizeHandle(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }

  const looksLikeUrl = trimmed.includes('/') || trimmed.startsWith('www.');
  const candidate = looksLikeUrl
    ? handleFromUrl(trimmed)
    : trimmed.startsWith('@')
      ? trimmed.slice(1)
      : trimmed;

  if (candidate === null || !HANDLE_PATTERN.test(candidate)) {
    return null;
  }

  return candidate.toLowerCase();
}

export function normalizeEmail(raw: string): string | null {
  const normalized = raw.trim().toLowerCase();
  if (!normalized || /\s/.test(normalized)) {
    return null;
  }

  const parts = normalized.split('@');
  if (parts.length !== 2) {
    return null;
  }

  const [local, domain] = parts;
  const dot = domain.indexOf('.');
  if (!local || !domain || dot <= 0 || dot === domain.length - 1) {
    return null;
  }

  return normalized;
}

export function isEligible(post: Post): boolean {
  return !post.isReply && !post.isRepost;
}
