/** Implemented by task C2. Signature is part of the seam — do not change it. */
export type EvidenceBand = 'good' | 'limited' | 'directional';

export function evidenceBand(eligibleCount: number): EvidenceBand | null {
  if (eligibleCount >= 15) {
    return 'good';
  }

  if (eligibleCount >= 5) {
    return 'limited';
  }

  if (eligibleCount >= 1) {
    return 'directional';
  }

  return null;
}
