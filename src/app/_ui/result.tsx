'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { linkFor } from '@/lib/catalog';
import type { PublicResult } from '@/lib/result';
import { labelForTopic } from '@/lib/taxonomy';
import { readStatus, errorCopy } from './api';
import { renderShareCard } from './share-card';

const metric = (n: number | null) => n === null ? 'Not available' : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
const safeUrl = (url: string) => { try { return ['https:', 'http:'].includes(new URL(url).protocol); } catch { return false; } };
export default function Result({ id }: { id: string }) {
  const router = useRouter();
  const [result, setResult] = useState<PublicResult | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const closedHeight = useRef(0);
  const [shareImage, setShareImage] = useState<{ blob: Blob; url: string } | null>(null);
  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!expanded || !card || !closedHeight.current || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const animation = card.animate(
      [{ height: `${closedHeight.current}px` }, { height: `${card.getBoundingClientRect().height}px` }],
      { duration: 480, easing: 'cubic-bezier(.2,.8,.2,1)' },
    );
    return () => animation.cancel();
  }, [expanded]);
  useEffect(() => {
    if (!expanded || !result) return;
    let cancelled = false;
    let url: string | undefined;
    void renderShareCard(result).then(blob => {
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setShareImage({ blob, url });
    }).catch(() => { /* Sharing can retry if preparing the optional preview fails. */ });
    return () => { cancelled = true; if (url) URL.revokeObjectURL(url); };
  }, [expanded, result]);
  const shareButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (expanded) shareButton.current?.focus({ preventScroll: true }); }, [expanded]);
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
  const evidence = result.kind === 'analysis' ? `${result.eligibleCount} posts analyzed${result.evidence === 'good' ? '' : result.evidence === 'limited' ? ' · Small sample' : ' · Very small sample'}` : result.signal.headline;
  const topics = result.kind === 'analysis' ? result.powerTopics : result.signal.topics;
  const components = result.kind === 'analysis'
    ? [['Topics', result.components.relevance], ['Depth', result.components.explanation], ['Streak', result.components.consistency], ['Reach', result.components.response]] satisfies [string, number][]
    : [['Audience', result.signal.components.audience], ['Output', result.signal.components.output], ['Activity', result.signal.components.activity], ['Topics', result.signal.components.topics]] satisfies [string, number][];
  async function share() {
    if (!result || sharing) return;
    setSharing(true); setShareError('');
    try {
      const blob = shareImage?.blob ?? await renderShareCard(result);
      const file = new File([blob], 'contribution-proof.png', { type: 'image/png' });
      if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: 'My contribution' }); }
      else { const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    } catch (e) { if (!(e instanceof DOMException && e.name === 'AbortError')) setShareError('Couldn’t share this time. Try again.'); }
    finally { setSharing(false); }
  }
  return <section className={`result ${expanded ? 'expanded' : ''}`}>
    <div ref={cardRef} className="result-card fade-in" aria-label="Your result card">
      <p className="handle">@{result.handle}</p>
      {!expanded ? <div className="score-reveal"><div className="reveal-stars" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></div><p className="helper">{title}</p><h1 className="score">{result.score}</h1><p className="evidence">{evidence}</p></div> : <>
        <div className="metric-grid">
          <div className="tile purple"><strong>{result.score}</strong><span>{title}</span></div>
          {result.kind === 'analysis' ? <><div className="tile green"><strong>{result.technologyCount}</strong><span>Technology posts</span></div><div className="tile blue"><strong>{metric(result.stats.totalViews)}</strong><span>Public views · analyzed posts</span></div><div className="tile yellow"><strong>{result.stats.longestStreakWeeks}</strong><span>Longest streak · weeks</span></div></> : <><div className="tile green"><strong>{metric(result.signal.profile.followers)}</strong><span>Followers</span></div><div className="tile blue"><strong>{metric(result.signal.profile.postsCount)}</strong><span>Posts</span></div><div className="tile yellow"><strong>{metric(result.signal.postsPerYear)}</strong><span>Posts per year</span></div></>}
        </div><p className="evidence">{evidence}</p>
      </>}
      {expanded && topics.length > 0 && <section className="card-topics" aria-label="Power Topics"><h2>Power Topics</h2><div className="pills">{topics.slice(0, 3).map(topic => <span key={topic}>{labelForTopic(topic)}</span>)}</div>{topics.length > 3 && <details><summary>{topics.length - 3} more topics</summary><div className="pills">{topics.slice(3).map(topic => <span key={topic}>{labelForTopic(topic)}</span>)}</div></details>}</section>}
      {result.kind === 'analysis' && <p className="helper result-window">{result.stats.from} — {result.stats.to}</p>}
    </div>
    {!expanded ? <button className="primary explore-button" onClick={() => { closedHeight.current = cardRef.current?.getBoundingClientRect().height ?? 0; setExpanded(true); }}>Explore my result</button> : <div className="result-details fade-in">
      <button ref={shareButton} className="primary" disabled={sharing} onClick={() => void share()}>{sharing ? 'Preparing…' : 'Share my card'}</button>
      {shareError && <p role="alert" className="error">{shareError}</p>}
      {shareImage && <details className="share-preview"><summary>Preview share image</summary><Image src={shareImage.url} width={1080} height={1080} unoptimized alt="Your square share card" /></details>}

      {result.kind === 'profile' && <div className="pills">{result.signal.signals.map(signal => <span key={signal.id} title={signal.detail}>{signal.label}</span>)}</div>}
      <details><summary>How it adds up</summary><div className="components">{components.map(([label, value]) => <div key={label}><span>{label}</span><meter min={0} max={analysis ? 250 : 25} value={value} aria-label={label} /><span>{value}</span></div>)}</div>
        {result.kind === 'analysis' && <p className="helper">Components are mapped to the contribution range. {result.eligibleCount} eligible posts analyzed. Eligibility is approximate: replies and reposts may not be fully excluded.</p>}
        {result.kind === 'profile' && <p className="helper">{result.signal.note}</p>}
        <p className="helper">An experimental signal from public activity, not a measure of skill or worth.</p>
      </details>
      {result.kind === 'analysis' && <details><summary>More about your posts</summary><dl className="stats"><dt>Window</dt><dd>{result.stats.from} – {result.stats.to}</dd><dt>Busiest day</dt><dd>{result.stats.busiestWeekday ?? 'Not available'}</dd><dt>Median length</dt><dd>{result.stats.medianLength} characters</dd><dt>Thread starts</dt><dd>{result.stats.threadStarts}</dd></dl></details>}
      {result.opportunities.length > 0 && <details><summary>Opportunities</summary><p className="helper">People here who work on what you post about</p>{result.opportunities.slice(0, 3).map(match => {
          // Some speakers have no public URL yet, so the card is only a link when it can be.
          const target = linkFor(match.project);
          const href = target && safeUrl(target) ? target : null;
          const inner = <><strong>{match.project.speaker} · {match.project.name}{href ? ' \u2197' : ''}</strong><span>{match.project.session}</span>{match.project.sponsor && <small>Sponsored</small>}</>;
          return href
            ? <a className="opportunity" key={match.project.id} href={href} target="_blank" rel="noreferrer">{inner}</a>
            : <div className="opportunity" key={match.project.id}>{inner}</div>;
        })}</details>}
      <p className="helper result-note">We’ll email you when early access opens.</p>
    </div>}
    <p className="helper ownership">Ownership not verified</p>
  </section>;
}
