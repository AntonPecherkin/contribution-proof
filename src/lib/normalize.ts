import type { Post } from './providers/types';

/** Implemented by task C2. Signatures are part of the seam — do not change them. */

export function normalizeHandle(_raw: string): string | null {
  throw new Error('not implemented — see docs/tasks/C2-normalize-evidence.md');
}

export function normalizeEmail(_raw: string): string | null {
  throw new Error('not implemented — see docs/tasks/C2-normalize-evidence.md');
}

export function isEligible(_post: Post): boolean {
  throw new Error('not implemented — see docs/tasks/C2-normalize-evidence.md');
}
