import type { AnalysisStatus } from '@/lib/result';
export async function readStatus(id: string, signal: AbortSignal): Promise<AnalysisStatus> {
  const response = await fetch(`/api/analyses/${encodeURIComponent(id)}`, { cache: 'no-store', signal });
  if (!response.ok) throw new Error(response.status === 404 ? 'This analysis is unavailable. Start again.' : 'Connection interrupted. Retrying…');
  return response.json();
}
export function errorCopy(kind: string) {
  switch (kind) {
    case 'invalid_handle': return 'We couldn’t find that handle. Check it and try again.';
    case 'private': return 'This account is private. Try a public X account.';
    case 'empty': return 'No eligible posts to analyze. Try another account.';
    case 'timeout': return 'We couldn’t finish this time. Please try again.';
    default: return 'Our provider couldn’t complete this request. Please try again.';
  }
}
