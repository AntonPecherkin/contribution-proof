'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';

import type { BoardPayload, BoardRow } from '../../../lib/board';

import './board.css';

/**
 * The room board, for a projector.
 *
 * Polls rather than subscribing: venue Wi-Fi drops websockets, and a reconnect bug on a
 * screen nobody is standing at is unrecoverable. A failed poll keeps the last good render
 * instead of flashing empty — a board that blanks looks broken even when it isn't.
 */

const POLL_MS = 5000;

const compact = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
  : n >= 1_000 ? `${(n / 1_000).toFixed(1)}k`
  : String(n);

function Row({ row, rank }: { row: BoardRow; rank?: number }) {
  return (
    <li className="board-row">
      {rank !== undefined && <span className="board-rank">{rank}</span>}
      <span className="board-handle">@{row.handle}</span>
      {/* Top Today is a ranking: a topic column there costs the handle the width it needs. */}
      {rank === undefined && row.topTopic && <span className="board-topic">{row.topTopic}</span>}
      <span className="board-score">{row.score}</span>
    </li>
  );
}

export default function BoardView({ slug }: { slug: string }) {
  const [board, setBoard] = useState<BoardPayload | null>(null);
  // Keeps the last good payload across a failed poll.
  const lastGood = useRef<BoardPayload | null>(null);

  useEffect(() => {
    let cancelled = false;

    const poll = async () => {
      try {
        const res = await fetch(`/api/events/${slug}/board`, { cache: 'no-store' });
        if (!res.ok) return;
        const next = (await res.json()) as BoardPayload;
        if (cancelled) return;
        lastGood.current = next;
        setBoard(next);
      } catch {
        // Hold the last render. A blank board reads as broken.
      }
    };

    void poll();
    const timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [slug]);

  const data = board ?? lastGood.current;

  return (
    <main className="board">
      <header className="board-head">
        <div className="board-brand">
          <Image src="/logo.png" alt="" width={96} height={96} priority />
          <p className="board-eyebrow">This room has analysed</p>
        </div>
        <dl className="board-totals">
          <div><dt>technology posts</dt><dd>{data ? compact(data.technologyPosts) : '—'}</dd></div>
          <div><dt>public views</dt><dd>{data?.totalViews != null ? compact(data.totalViews) : 'Not available'}</dd></div>
          <div><dt>builders</dt><dd>{data ? data.analysed : '—'}</dd></div>
        </dl>
      </header>

      <div className="board-columns">
        <section>
          <h2>Just in</h2>
          {/*
            An empty column reads as a broken screen, and the board is emptiest in the first
            ten minutes when the most people are looking at it. Say something instead.
          */}
          {data && data.justIn.length === 0 ? (
            <p className="board-empty">Scan the code to be the first</p>
          ) : (
            <ul>{data?.justIn.map((r) => <Row key={r.handle} row={r} />)}</ul>
          )}
        </section>
        <section>
          <h2>Top today</h2>
          {data && data.topToday.length === 0 ? (
            <p className="board-empty">Filling up shortly</p>
          ) : (
            <ul>{data?.topToday.map((r, i) => <Row key={r.handle} row={r} rank={i + 1} />)}</ul>
          )}
        </section>
      </div>

      <footer className="board-foot">
        {data && data.roomTopics.length > 0 && (
          <p className="board-topics">{data.roomTopics.join(' · ')}</p>
        )}
        <p className="board-note">Handles are self-declared · ownership is not verified</p>
      </footer>
    </main>
  );
}
