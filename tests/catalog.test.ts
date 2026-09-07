import { describe, expect, it } from 'vitest';

import { CATALOG, matchProjects } from '../src/lib/catalog';
import { TAXONOMY } from '../src/lib/taxonomy';

describe('catalog', () => {
  it('only references topics that exist in the taxonomy', () => {
    const known = new Set(TAXONOMY.map((t) => t.id));
    for (const p of CATALOG) {
      for (const t of p.topics) expect(known, `${p.id} -> ${t}`).toContain(t);
    }
  });

  it('returns at most three, ordered by overlap', () => {
    const m = matchProjects(['smart-contracts', 'cryptography', 'security', 'devtools']);
    expect(m.length).toBeLessThanOrEqual(3);
    for (let i = 1; i < m.length; i += 1) {
      expect(m[i - 1].overlap.length).toBeGreaterThanOrEqual(m[i].overlap.length);
    }
  });

  it('gives no opportunities rather than irrelevant ones', () => {
    expect(matchProjects([])).toEqual([]);
    expect(matchProjects(['not-a-topic'])).toEqual([]);
  });

  it('explains itself by returning the shared topics', () => {
    const [first] = matchProjects(['cryptography']);
    expect(first.overlap).toContain('cryptography');
  });

  it('gives a sponsor no ranking advantage', () => {
    // A sponsored entry with one overlap must lose to an unsponsored one with two.
    const m = matchProjects(['payments', 'security', 'smart-contracts']);
    const sponsored = m.findIndex((x) => x.project.sponsor);
    const better = m.findIndex((x) => !x.project.sponsor && x.overlap.length >= 2);
    if (sponsored >= 0 && better >= 0) expect(better).toBeLessThan(sponsored);
  });

  it('is stable across calls, so a refresh does not reshuffle the result', () => {
    const topics = ['devtools', 'security', 'scaling'];
    expect(matchProjects(topics).map((m) => m.project.id))
      .toEqual(matchProjects(topics).map((m) => m.project.id));
  });
});
