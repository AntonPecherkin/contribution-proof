import { describe, expect, it } from 'vitest';
import { evidenceBand } from '../src/lib/evidence';

/**
 * SKIPPED until task C2 implements it. Un-skip as your first step, watch it fail, then
 * make it pass. Do not change an assertion — if you believe one is wrong, say so in the
 * PR and leave it.
 */
describe.skip('evidenceBand', () => {
  it('calls 15 or more analyzed posts good evidence', () => {
    expect(evidenceBand(15)).toBe('good');
    expect(evidenceBand(20)).toBe('good');
  });

  it('treats an unusually large sample as good rather than out of range', () => {
    expect(evidenceBand(97)).toBe('good');
  });

  it('calls 5 to 14 limited evidence', () => {
    expect(evidenceBand(5)).toBe('limited');
    expect(evidenceBand(14)).toBe('limited');
  });

  it('calls 1 to 4 a directional result', () => {
    expect(evidenceBand(1)).toBe('directional');
    expect(evidenceBand(4)).toBe('directional');
  });

  it('returns null at zero, because no score may be shown at all', () => {
    expect(evidenceBand(0)).toBeNull();
  });

  it('never returns a band for a negative count', () => {
    expect(evidenceBand(-1)).toBeNull();
  });
});
