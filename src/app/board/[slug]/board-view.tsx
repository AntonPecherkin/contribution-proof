'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import type { BoardPayload, BoardRow } from '../../../lib/board';
import './board.css';

const compact = (n: number) => new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(n);

function RankedRow({ row, rank }: { row: BoardRow; rank: number }) {
  return <li className="board-row"><span className="board-rank">0{rank}</span><div className="board-row-person"><span className="board-handle">@{row.handle}</span>{row.topTopic && <span className="board-topic">{row.topTopic}</span>}</div><strong className="board-score" key={row.score}>{row.score}</strong></li>;
}

export default function BoardView({ slug }: { slug: string }) {
  const [board, setBoard] = useState<BoardPayload | null>(null);
  const [connected, setConnected] = useState(false);
  const [failed, setFailed] = useState(false);
  const [spotlight, setSpotlight] = useState(0);
  const [arrival, setArrival] = useState<string | null>(null);
  const [joinHost, setJoinHost] = useState('');
  const seen = useRef(new Set<string>());
  const initialized = useRef(false);

  useEffect(() => {
    setJoinHost(window.location.host);
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const response = await fetch(`/api/events/${encodeURIComponent(slug)}/board`, {
          cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(8000)]),
        });
        if (!response.ok) throw new Error('Board unavailable');
        const next: BoardPayload = await response.json();
        if (controller.signal.aborted) return;
        const fresh = next.justIn.find(row => !seen.current.has(row.handle));
        if (initialized.current && fresh) { setArrival(fresh.handle); setSpotlight(next.justIn.findIndex(row => row.handle === fresh.handle)); }
        seen.current = new Set(next.justIn.map(row => row.handle));
        initialized.current = true;
        setBoard(next); setConnected(true); setFailed(false);
      } catch {
        if (!controller.signal.aborted) { setConnected(false); setFailed(true); }
      } finally {
        if (!controller.signal.aborted) timer = setTimeout(poll, 5000);
      }
    }
    void poll();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [slug]);

  const count = board?.justIn.length ?? 0;
  useEffect(() => {
    if (count < 2) return;
    const timer = setInterval(() => setSpotlight(value => (value + 1) % count), 12000);
    return () => clearInterval(timer);
  }, [count]);
  useEffect(() => {
    if (!arrival) return;
    const timer = setTimeout(() => setArrival(null), 10000);
    return () => clearTimeout(timer);
  }, [arrival]);

  const featured = count ? board!.justIn[spotlight % count] : null;
  const leaders = board?.topToday.filter(row => row.kind === 'analysis') ?? [];
  return <main className="board">
    <header className="board-head"><div className="board-brand"><Image src="/contentdc-logo.png" alt="ContentDC" width={80} height={80} priority /><div><p className="board-eyebrow">ContentDC · Contribution Proof</p><h1>The room is building.</h1></div></div>
      <p className={`board-connection ${connected ? 'is-live' : ''}`} role="status"><span />{connected ? 'Live room' : failed ? 'Reconnecting' : 'Connecting'}</p>
    </header>
    <dl className="board-totals">
      <div><dt>Profiles explored</dt><dd key={board?.analysed}>{board ? compact(board.analysed) : '—'}</dd></div>
      <div><dt>Technology posts</dt><dd key={board?.technologyPosts}>{board ? compact(board.technologyPosts) : '—'}</dd></div>
      <div><dt>Public views</dt><dd key={board?.totalViews}>{board?.totalViews != null ? compact(board.totalViews) : 'Not available'}</dd></div>
    </dl>
    <div className="board-stage">
      <section className="board-spotlight"><p className="board-section-label">{arrival && featured?.handle === arrival ? 'New on the board' : 'Room spotlight'} <span aria-hidden="true">✦</span></p>
        {featured ? <div key={featured.handle} className="board-featured"><h2>@{featured.handle}</h2><p className="board-featured-kind">{featured.kind === 'analysis' ? 'Contribution Score' : 'Profile Score'}</p><strong className="board-featured-score">{featured.score}</strong>{featured.topTopic && <p className="board-featured-topic">{featured.topTopic}</p>}</div>
          : <div className="board-invitation"><span aria-hidden="true">✦</span><h2>{board ? 'Your story belongs here.' : 'Getting the room ready.'}</h2><p>{board ? 'Explore your contribution. Meet your next collaborators.' : failed ? 'Waiting for the connection to return.' : 'Connecting to the room.'}</p></div>}
        <a className="board-join" href="/" target="_blank" rel="noreferrer"><span>Discover your contribution</span><strong>{joinHost || 'Open the event link'} <span aria-hidden="true">↗</span></strong></a>
      </section>
      <section className="board-leaders"><p className="board-section-label">Top contributions <span>Today</span></p>
        {leaders.length ? <ol>{leaders.map((row, i) => <RankedRow key={row.handle} row={row} rank={i + 1} />)}</ol> : <div className="board-leader-empty"><h2>The next name could be yours.</h2><p>Contributions appear here as the room takes part.</p></div>}
        <div className="board-room-topics"><p className="board-section-label">What this room explores</p><div>{board?.roomTopics.length ? board.roomTopics.map(topic => <span key={topic}>{topic}</span>) : <span>Topics emerge as profiles are explored.</span>}</div></div>
      </section>
    </div>
    <div className="board-arrivals"><span className="board-arrivals-label">Just in</span><div>{board?.justIn.length ? board.justIn.slice(0, 6).map(row => <span key={row.handle} className={`board-arrival ${arrival === row.handle ? 'is-new' : ''}`}>@{row.handle}</span>) : <span className="board-arrival-placeholder">The room starts with you.</span>}</div></div>
    <footer className="board-foot"><span>Only opted-in handles appear · ownership is not verified</span><span>Experimental scores · public activity</span></footer>
  </main>;
}
