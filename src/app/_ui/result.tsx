'use client';
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import Recommendations, { ResultTabs } from './recommendations';
import type { PublicResult } from '@/lib/result';
import { labelForTopic } from '@/lib/taxonomy';
import { readStatus, errorCopy } from './api';
import { renderShareCard } from './share-card';

const metric = (n: number | null) => n === null ? 'Not available' : new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);
// Approximate on purpose: one person can like a post and repost it, so the sum of
// engagements is an upper bound on people. Showing it bare would claim a precision we do
// not have.
const approx = (n: number) => `~${new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n)}`;
export default function Result({ id, view = 'card' }: { id: string; view?: 'card' | 'trends' }) {
  const router = useRouter();
  const [result, setResult] = useState<PublicResult | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [expanded, setExpanded] = useState(view === 'trends');
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
  const [imageAttempt, setImageAttempt] = useState(0);
  useEffect(() => {
    if (!expanded || !result) return;
    setShareError('');
    setShareImage(null);
    let cancelled = false;
    let url: string | undefined;
    let timeout: ReturnType<typeof setTimeout>;
    const deadline = new Promise<never>((_, reject) => { timeout = setTimeout(() => reject(new Error('Image preparation timed out')), 12000); });
    void Promise.race([renderShareCard(result), deadline]).then(blob => {
      if (cancelled) return;
      url = URL.createObjectURL(blob);
      setShareImage({ blob, url });
    }).catch(() => { if (!cancelled) setShareError('Couldn’t prepare your image. Try again.'); }).finally(() => clearTimeout(timeout));
    return () => { cancelled = true; clearTimeout(timeout); if (url) URL.revokeObjectURL(url); };
  }, [expanded, result, imageAttempt]);
  const shareButton = useRef<HTMLButtonElement>(null);
  useEffect(() => { if (expanded && shareImage && view === 'card') shareButton.current?.focus({ preventScroll: true }); }, [expanded, shareImage, view]);
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
  function download() {
    if (!shareImage) return;
    const anchor = document.createElement('a');
    anchor.href = shareImage.url;
    anchor.download = 'contribution-proof.png';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  }
  if (view === 'trends') return <section className="result trends-page"><ResultTabs id={id} view="trends" /><Recommendations result={result} /></section>;
  return <section className={`result ${expanded ? 'expanded' : ''}`}>
    {expanded && <ResultTabs id={id} view="card" />}
    <div ref={cardRef} className="result-card fade-in" aria-label="Your result card">
      <p className="handle">@{result.handle}</p>
      {!expanded ? <div className="score-reveal"><div className="reveal-stars" aria-hidden="true"><span>✦</span><span>✧</span><span>✦</span></div><p className="helper">{title}</p><h1 className="score">{result.score}</h1><p className="evidence">{evidence}</p></div> : <>
        <div className="metric-grid">
          <div className="tile purple"><strong>{result.score}</strong><span>{title}</span></div>
          {result.kind === 'analysis' ? <>{result.peopleEngaged !== null
            ? <div className="tile green"><strong>{approx(result.peopleEngaged)}</strong><span>People engaged in tech · estimated</span></div>
            : <div className="tile green"><strong>{result.technologyCount}</strong><span>Technology posts</span></div>}
          {result.daysBuilding !== null
            ? <div className="tile blue"><strong>{new Intl.NumberFormat('en').format(result.daysBuilding)}</strong><span>Days building in public</span></div>
            : <div className="tile blue"><strong>{metric(result.stats.totalViews)}</strong><span>Times your posts were seen</span></div>}<div className="tile yellow"><strong>{result.stats.longestStreakWeeks}</strong><span>Longest streak · weeks</span></div></> : <><div className="tile green"><strong>{metric(result.signal.profile.followers)}</strong><span>Followers</span></div><div className="tile blue"><strong>{metric(result.signal.profile.postsCount)}</strong><span>Posts</span></div><div className="tile yellow"><strong>{metric(result.signal.postsPerYear)}</strong><span>Posts per year</span></div></>}
        </div><p className="evidence">{evidence}</p>
      </>}
      {expanded && topics.length > 0 && <section className="card-topics" aria-label="Topics to build on"><h2>Topics to build on</h2><p className="helper topic-direction">Your next narrative starts here.</p><div className="pills">{topics.slice(0, 3).map(topic => <span key={topic}>{labelForTopic(topic)}</span>)}</div>{topics.length > 3 && <details><summary>{topics.length - 3} more topics</summary><div className="pills">{topics.slice(3).map(topic => <span key={topic}>{labelForTopic(topic)}</span>)}</div></details>}</section>}
      {result.kind === 'analysis' && <p className="helper result-window">{result.stats.from} — {result.stats.to}</p>}
    </div>
    {!expanded ? <button className="primary explore-button" onClick={() => { closedHeight.current = cardRef.current?.getBoundingClientRect().height ?? 0; setExpanded(true); }}>Explore my result</button> : <div className="result-details fade-in">
      <button ref={shareButton} className="primary" disabled={!shareImage} onClick={download}>{shareImage ? 'Download my card' : 'Preparing card…'}</button>
      <Link className="next-trends" href={`/result/${encodeURIComponent(id)}?view=trends`}>Explore my opportunities <span aria-hidden="true">→</span></Link>
      {shareError && <div><p role="alert" className="error">{shareError}</p><button className="text-action retry-image" onClick={() => setImageAttempt(imageAttempt + 1)}>Retry image</button></div>}
      {shareImage && <details className="share-preview"><summary>Preview share image</summary><Image src={shareImage.url} width={1080} height={1080} unoptimized alt="Your square share card" /></details>}

      {result.kind === 'profile' && <div className="pills">{result.signal.signals.map(signal => <span key={signal.id} title={signal.detail}>{signal.label}</span>)}</div>}
      <details><summary>How it adds up</summary><div className="components">{components.map(([label, value]) => <div key={label}><span>{label}</span><meter min={0} max={analysis ? 250 : 25} value={value} aria-label={label} /><span>{value}</span></div>)}</div>
        {result.kind === 'analysis' && <p className="helper">Components are mapped to the contribution range. {result.eligibleCount} eligible posts analyzed. Eligibility is approximate: replies and reposts may not be fully excluded.</p>}
        {result.kind === 'profile' && <p className="helper">{result.signal.note}</p>}
        <p className="helper">An experimental signal from public activity, not a measure of skill or worth.</p>
      </details>
      {result.kind === 'analysis' && <details><summary>More about your posts</summary><dl className="stats"><dt>Window</dt><dd>{result.stats.from} – {result.stats.to}</dd><dt>Busiest day</dt><dd>{result.stats.busiestWeekday ?? 'Not available'}</dd><dt>Median length</dt><dd>{result.stats.medianLength} characters</dd><dt>Thread starts</dt><dd>{result.stats.threadStarts}</dd><dt>Best post</dt><dd>{result.stats.bestPost?.views != null ? `${metric(result.stats.bestPost.views)} views` : 'Not available'}</dd></dl></details>}
      <p className="helper result-note">We’ll email you when early access opens.</p>
    </div>}
    <p className="helper ownership">Ownership not verified</p>
  </section>;
}
