import { describe, expect, it } from 'vitest';

import { CATALOG, linkFor, matchProjects } from '../src/lib/catalog';
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
    const [first] = matchProjects(['creator-economy']);
    expect(first.overlap).toContain('creator-economy');
  });

  it('gives a sponsor no ranking advantage', () => {
    const m = matchProjects(['payments', 'security', 'smart-contracts']);
    const sponsored = m.findIndex((x) => x.project.sponsor);
    const better = m.findIndex((x) => !x.project.sponsor && x.overlap.length >= 2);
    if (sponsored >= 0 && better >= 0) expect(better).toBeLessThan(sponsored);
  });

  it('names a person for every entry, because the point is who to go and talk to', () => {
    for (const p of CATALOG) {
      expect(p.speaker.length, p.id).toBeGreaterThan(1);
      expect(p.name.length, p.id).toBeGreaterThan(1);
    }
  });

  it('covers enough of the taxonomy that a typical participant matches something', () => {
    // Every measured account's power topics must find at least one person to talk to.
    const measured = [
      ['open-source', 'identity', 'mechanism-design', 'scaling', 'creator-economy'],
      ['scaling', 'open-source', 'devtools', 'smart-contracts', 'performance'],
      ['prediction', 'open-source', 'consensus', 'scaling', 'mechanism-design'],
      ['creator-economy', 'ml-systems', 'language-models'],
    ];
    for (const topics of measured) expect(matchProjects(topics).length).toBeGreaterThan(0);
  });

  it('is stable across calls, so a refresh does not reshuffle the result', () => {
    const topics = ['devtools', 'security', 'scaling'];
    expect(matchProjects(topics).map((m) => m.project.id))
      .toEqual(matchProjects(topics).map((m) => m.project.id));
  });

  it('prefers the speaker over the company, because the point is who to find', () => {
    const withHandle = CATALOG.find((p) => p.handle)!;
    expect(linkFor(withHandle)).toBe(`https://x.com/${withHandle.handle}`);
  });

  it('returns null rather than a dead card when there is nowhere to send anyone', () => {
    expect(linkFor({ ...CATALOG[0], handle: undefined, url: '' })).toBeNull();
  });

  it('most entries are reachable, so the list is worth opening', () => {
    const reachable = CATALOG.filter((p) => linkFor(p) !== null).length;
    expect(reachable).toBeGreaterThanOrEqual(CATALOG.length - 2);
  });
});
