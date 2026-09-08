'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { PublicResult } from '@/lib/result';
import { labelForTopic } from '@/lib/taxonomy';
import { readStatus, errorCopy } from './api';

const metric = (n: number | null) => n === null ? 'Not available' : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const safeUrl = (url: string) => { try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; } };
export default function Result({ id }: { id: string }) {
  const router = useRouter();
  const [result, setResult] = useState<PublicResult | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    let cancelled = false;
    const timeout = setTimeout(() => controller.abort(), 20000);
    setError('');
    readStatus(id, controller.signal).then(data => {
      if (cancelled) return;
      if (data.status === 'complete') setResult(data.result);
      else if (data.status === 'failed') setError(errorCopy(data.errorClass));
      else router.replace(`/analyzing/${encodeURIComponent(id)}`);
    }).catch(() => { if (!cancelled) setError('Couldn’t load your result. Try again.'); }).finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); controller.abort(); };
  }, [id, attempt, router]);
  if (error) return <section className="journey"><h1>Result unavailable</h1><p role="alert" className="helper">{error}</p><button className="primary" onClick={() => setAttempt(attempt + 1)}>Retry</button><Link className="text-action" href="/">Start again</Link></section>;
  if (!result) return <section className="journey"><h1 role="status">Loading your result…</h1></section>;
  if (result.kind === 'analysis' && result.eligibleCount === 0) return <section className="journey"><h1>No posts to analyze</h1><p className="helper">No score to show this time.</p><Link href="/" className="primary">Try again</Link></section>;
  const analysis = result.kind === 'analysis';
  const title = analysis ? 'Contribution Score' : 'Profile Score';
  const evidence = result.kind === 'analysis' ? `${result.eligibleCount} posts · ${{ good: 'Good evidence', limited: 'Limited evidence', directional: 'Directional result' }[result.evidence]}` : result.signal.headline;
  const topics = result.kind === 'analysis' ? result.powerTopics : result.signal.topics;
  const components = result.kind === 'analysis'
    ? [['Topics', result.components.relevance], ['Depth', result.components.explanation], ['Streak', result.components.consistency], ['Reach', result.components.response]] satisfies [string, number][]
    : [['Audience', result.signal.components.audience], ['Output', result.signal.components.output], ['Activity', result.signal.components.activity], ['Topics', result.signal.components.topics]] satisfies [string, number][];
  async function share() {
    if (!result || sharing) return;
    setSharing(true); setShareError('');
    try {
      await document.fonts.ready;
      const canvas = document.createElement('canvas'); canvas.width = 1080; canvas.height = 1080;
      const ctx = canvas.getContext('2d'); if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#171717'; ctx.fillRect(0, 0, 1080, 1080);
      ctx.fillStyle = '#fff'; ctx.font = '500 40px Inter'; ctx.fillText('ContentDC · Contribution Proof', 72, 110);
      ctx.font = '400 32px Inter'; ctx.fillText(`@${result.handle}`, 72, 210); ctx.fillText(title, 72, 320);
      ctx.fillStyle = '#b479ff'; ctx.font = '700 240px Inter'; ctx.fillText(String(result.score), 60, 590);
      ctx.fillStyle = '#fff'; ctx.font = '400 34px Inter'; ctx.fillText(evidence, 72, 710);
      ctx.font = '400 24px Inter'; topics.slice(0, 3).forEach((topic, i) => ctx.fillText(labelForTopic(topic), 72, 790 + i * 38));
      ctx.fillStyle = '#b2b2b2'; ctx.font = '400 22px Inter'; ctx.fillText('Experimental · X ownership not verified', 72, 990);
      const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Image failed')), 'image/png'));
      const file = new File([blob], 'contribution-proof.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'My contribution' }); }
      else { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setShareError('Couldn’t share this time. Try again.'); }
    finally { setSharing(false); }
  }
  return <section className={`result ${expanded ? 'expanded' : ''}`}>
    <div className="result-card fade-in">
      <p className="handle">@{result.handle}</p>
      {!expanded ? <div className="score-reveal"><p className="helper">{title}</p><h1 className="score">{result.score}</h1><p className="evidence">{evidence}</p></div> : <>
        <div className="metric-grid">
          <div className="tile purple"><strong>{result.score}</strong><span>{title}</span></div>
          {result.kind === 'analysis' ? <><div className="tile green"><strong>{result.technologyCount}</strong><span>Technology posts</span></div><div className="tile blue"><strong>{metric(result.stats.totalViews)}</strong><span>Public views · analyzed posts</span></div><div className="tile yellow"><strong>{result.stats.longestStreakWeeks}</strong><span>Longest streak · weeks</span></div></> : <><div className="tile green"><strong>{metric(result.signal.profile.followers)}</strong><span>Followers</span></div><div className="tile blue"><strong>{metric(result.signal.profile.postsCount)}</strong><span>Posts</span></div><div className="tile yellow"><strong>{metric(result.signal.postsPerYear)}</strong><span>Posts per year</span></div></>}
        </div><p className="evidence">{evidence}</p>
      </>}
    </div>
    {!expanded ? <button className="primary explore-button" onClick={() => setExpanded(true)}>Explore my result</button> : <div className="result-details fade-in">
      {result.kind === 'profile' && <div className="pills">{result.signal.signals.map(signal => <span key={signal.id} title={signal.detail}>{signal.label}</span>)}</div>}
      {topics.length > 0 && <section><h2>Power Topics</h2><div className="pills">{topics.map(topic => <span key={topic}>{labelForTopic(topic)}</span>)}</div></section>}
      <details><summary>How it adds up</summary><div className="components">{components.map(([label, value]) => <div key={label}><span>{label}</span><meter min={0} max={analysis ? 250 : 25} value={value} aria-label={label} /><span>{value}</span></div>)}</div>
        {result.kind === 'analysis' && <p className="helper">Components are mapped to the contribution range. {result.eligibleCount} eligible posts analyzed. Eligibility is approximate: replies and reposts may not be fully excluded.</p>}
        {result.kind === 'profile' && <p className="helper">{result.signal.note}</p>}
        <p className="helper">An experimental signal from public activity, not a measure of skill or worth.</p>
      </details>
      {result.kind === 'analysis' && <details><summary>More about your posts</summary><dl className="stats"><dt>Window</dt><dd>{result.stats.from} – {result.stats.to}</dd><dt>Busiest day</dt><dd>{result.stats.busiestWeekday ?? 'Not available'}</dd><dt>Median length</dt><dd>{result.stats.medianLength} characters</dd><dt>Thread starts</dt><dd>{result.stats.threadStarts}</dd></dl></details>}
      <button className="primary" disabled={sharing} onClick={() => void share()}>{sharing ? 'Preparing…' : 'Share my card'}</button>
      {shareError && <p role="alert" className="error">{shareError}</p>}
      {result.opportunities.length > 0 && <details><summary>Opportunities</summary><p className="helper">Example catalog · event projects coming soon</p>{result.opportunities.filter(match => safeUrl(match.project.url)).slice(0, 3).map(match => <a className="opportunity" key={match.project.id} href={match.project.url} target="_blank" rel="noreferrer"><strong>{match.project.name} ↗</strong><span>{match.project.needs}</span>{match.project.sponsor && <small>Sponsored</small>}</a>)}</details>}
      <p className="helper result-note">We’ll email you when early access opens.</p>
    </div>}
    <p className="helper ownership">Ownership not verified</p>
  </section>;
}
