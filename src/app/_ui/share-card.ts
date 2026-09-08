import type { PublicResult } from '@/lib/result';
import { labelForTopic } from '@/lib/taxonomy';

/**
 * Loads the logo, or gives up.
 *
 * `decode()` never settles while the tab is hidden - Chrome defers image decoding in a
 * backgrounded tab - so awaiting it bare leaves the share button on "Preparing..." forever,
 * with no error and nothing to retry. On a phone that is one app-switch away: tap share,
 * glance at a notification, come back to a dead button.
 *
 * A card without the mark is worth far more than a card that never arrives, so this resolves
 * null rather than throwing, and the caller draws around it.
 */
const LOGO_TIMEOUT_MS = 3000;

async function loadLogo(): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    const done = (value: HTMLImageElement | null) => {
      clearTimeout(timer);
      resolve(value);
    };
    const timer = setTimeout(() => done(null), LOGO_TIMEOUT_MS);
    image.onload = () => done(image);
    image.onerror = () => done(null);
    image.src = '/contentdc-logo.png';
  });
}

/** One self-contained square composition, sized for sharing at phone-feed scale. */
export async function renderShareCard(result: PublicResult): Promise<Blob> {
  await document.fonts.load('700 280px Inter');
  await document.fonts.load('500 26px Inter');
  await document.fonts.ready;
  const logo = await loadLogo();
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = 1080;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas unavailable');
  const box = (x: number, y: number, w: number, h: number, color: string, radius = 28) => {
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, radius); ctx.fill();
  };
  const text = (value: string, x: number, y: number, size: number, color = '#ffffff', weight = 500, width = 984) => {
    ctx.fillStyle = color;
    ctx.font = `${weight} ${size}px Inter`;
    // Fit real labels without truncating a topic or changing the underlying value.
    while (ctx.measureText(value).width > width && size > 16) {
      size--; ctx.font = `${weight} ${size}px Inter`;
    }
    ctx.fillText(value, x, y);
  };
  const analysis = result.kind === 'analysis';
  const topics = analysis ? result.powerTopics : result.signal.topics;
  box(0, 0, 1080, 1080, '#171717', 0);
  // The wordmark carries the brand on its own when the mark could not be loaded.
  if (logo) ctx.drawImage(logo, 48, 42, 56, 56);
  text('ContentDC', 120, 83, 32, '#ffffff', 650);
  text('CONTRIBUTION PROOF', 650, 85, 20, '#b8b8b8', 500, 382);

  box(48, 132, 632, 480, '#4f00af');
  text(`@${result.handle}`, 80, 185, 26, '#e0caff', 500, 568);
  text(analysis ? 'Contribution Score' : 'Profile Score', 80, 243, 32, '#ffffff', 500, 568);
  text(String(result.score), 68, 486, 270, '#ffffff', 750, 578);
  box(80, 535, 568, 45, '#dbbd07', 12);
  const evidence = analysis
    ? `${result.eligibleCount} posts · ${{ good: 'Based on public posts', limited: 'Small sample', directional: 'Very small sample' }[result.evidence]}`
    : 'Based on your public profile';
  text(evidence, 98, 565, 21, '#201c00', 550, 532);

  const metrics: Array<{ value: number | null; label: string; color: string; note?: string; approximate?: boolean; fullNumber?: boolean }> = analysis
    ? [
      result.peopleEngaged != null
        ? { value: result.peopleEngaged, label: 'People engaged in tech', note: 'Estimated · not unique people', approximate: true, color: '#07db71' }
        : { value: result.technologyCount, label: 'Technology posts', color: '#07db71' },
      result.daysBuilding != null
        ? { value: result.daysBuilding, label: 'Days building in public', fullNumber: true, color: '#58b8fe' }
        : { value: result.stats.totalViews, label: 'Times your posts were seen', note: 'Across analyzed posts', color: '#58b8fe' },
      { value: result.stats.longestStreakWeeks, label: 'Week streak', color: '#dbbd07' },
    ]
    : [
      { value: result.signal.profile.followers, label: 'Followers', color: '#07db71' },
      { value: result.signal.profile.postsCount, label: 'Posts', color: '#58b8fe' },
      { value: result.signal.postsPerYear, label: 'Posts per year', color: '#dbbd07' },
    ];
  metrics.forEach(({ value, label, color, note, approximate, fullNumber }, i) => {
    const y = 132 + i * 165;
    box(696, y, 336, 150, color);
    const display = value === null ? 'Not available' : `${approximate ? '~' : ''}${new Intl.NumberFormat('en', fullNumber ? {} : { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`;
    text(display, 720, y + 72, value === null ? 30 : 64, '#081925', 700, 288);
    text(label, 720, y + 109, 24, '#081925', 500, 288);
    if (note) text(note, 720, y + 134, 17, '#081925', 400, 288);
  });

  box(48, 632, 984, 292, '#242424');
  text(topics.length ? 'TOPICS TO BUILD ON' : 'PUBLIC PROFILE', 80, 680, 19, '#bda6da', 600);
  if (topics.length) {
    topics.slice(0, 3).forEach((topic, i) => {
      const label = labelForTopic(topic);
      ctx.font = '500 25px Inter';
      const width = Math.min(920, ctx.measureText(label).width + 40);
      box(80, 703 + i * 65, width, 51, '#34303c', 25);
      text(label, 100, 737 + i * 65, 25, '#f1e6ff', 500, 880);
    });
  } else {
    text(analysis ? 'Your public activity, in focus.' : result.signal.headline, 80, 768, 36, '#ffffff', 550, 920);
    text('A snapshot of your public activity.', 80, 825, 25, '#b8b8b8', 400, 920);
  }
  if (analysis) text(`Posts analyzed: ${result.stats.from} — ${result.stats.to}`, 48, 968, 21, '#b8b8b8');
  else text('Profile Score · public profile data', 48, 968, 21, '#b8b8b8');
  text('Experimental · X ownership not verified', 48, 1022, 21, '#b8b8b8');
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Image failed')), 'image/png'));
}
