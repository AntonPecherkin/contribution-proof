import type { PublicResult } from '@/lib/result';
import { labelForTopic } from '@/lib/taxonomy';

/** One self-contained square composition, sized for sharing at phone-feed scale. */
export async function renderShareCard(result: PublicResult): Promise<Blob> {
  await document.fonts.load('700 280px Inter');
  await document.fonts.load('500 26px Inter');
  await document.fonts.ready;
  const logo = new Image();
  logo.src = '/contentdc-logo.png';
  await logo.decode();
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
    ctx.fillText(value, x, y, width);
  };
  const analysis = result.kind === 'analysis';
  const topics = analysis ? result.powerTopics : result.signal.topics;
  box(0, 0, 1080, 1080, '#171717', 0);
  text('ContentDC', 48, 88, 32, '#ffffff', 650);
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

  box(696, 132, 336, 232, '#07db71');
  ctx.drawImage(logo, 776, 145, 176, 176);
  text('YOUR PUBLIC SIGNAL', 733, 342, 18, '#072416', 600, 262);
  box(696, 380, 336, 232, '#58b8fe');
  const value = analysis ? result.technologyCount : result.signal.profile.followers;
  const display = value === null ? 'Not available' : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value);
  text(display, 724, 487, value === null ? 34 : 78, '#081925', 700, 280);
  text(analysis ? 'Technology posts' : 'Followers', 724, 549, 25, '#081925', 500, 280);

  box(48, 632, 984, 292, '#242424');
  text(topics.length ? 'POWER TOPICS' : 'PUBLIC PROFILE', 80, 680, 19, '#bda6da', 600);
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
