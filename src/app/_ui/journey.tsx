'use client';
import BrandOrbit from './brand-orbit';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { readStatus, errorCopy } from './api';
const phrases = ['Finding your contribution', 'Collecting your public posts', 'Finding your contribution signals', 'Your result is ready'];
export default function Journey({ id }: { id: string }) {
  const router = useRouter();
  const [stage, setStage] = useState(0);
  const [profile, setProfile] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState('');
  const [connection, setConnection] = useState('');
  useEffect(() => {
    const controller = new AbortController();
    const start = Date.now();
    let current = 0, reached = 0, changed = start;
    let finished = false, stopped = false;
    let nextPoll: ReturnType<typeof setTimeout>;
    const clock = setInterval(() => {
      if (stopped) return;
      const now = Date.now(); setElapsed(now - start);
      if (!finished && now - start >= 180000) { stopped = true; controller.abort(); setError(errorCopy('timeout')); return; }
      if (current < reached && now - changed >= 900) { current++; changed = now; setStage(current); }
      if (finished && current === 3 && now - changed >= 900) { stopped = true; router.replace(`/result/${encodeURIComponent(id)}`); }
    }, 100);
    async function poll() {
      try {
        const data = await readStatus(id, AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]));
        if (stopped || controller.signal.aborted) return;
        if (data.status === 'failed') { stopped = true; setError(errorCopy(data.errorClass)); return; }
        reached = Math.max(reached, ['queued', 'fetching', 'scoring', 'complete'].indexOf(data.status));
        finished = data.status === 'complete';
        if (data.status === 'complete') setProfile(data.result.kind === 'profile');
        setConnection('');
      } catch { if (!stopped && !controller.signal.aborted) setConnection('Connection interrupted. Reconnecting…'); }
      if (!stopped && !finished && !controller.signal.aborted) nextPoll = setTimeout(poll, 1500);
    }
    void poll();
    return () => { stopped = true; controller.abort(); clearInterval(clock); clearTimeout(nextPoll); };
  }, [id, router]);
  if (error) return <section className="journey fade-in"><h1>Let’s try again.</h1><p role="alert" className="helper">{error}</p><Link href="/" className="primary">Try again</Link></section>;
  return <section className="journey fade-in"><h1 key={stage} className="fade-in" aria-live="polite" aria-atomic="true">{profile && stage === 2 ? 'Finding your profile signals' : phrases[stage]}</h1>
    <div className="waiting-card">{stage < 2 ? <BrandOrbit waiting /> : <div className="signal-grid fade-in">{(profile ? ['Audience', 'Output', 'Activity', 'Topics'] : ['Topics', 'Depth', 'Streak', 'Reach']).map((label, i) => <div key={label}><span aria-hidden="true">{['✳', '▦', '⠿', '◌'][i]}</span>{label}</div>)}</div>}</div>
    <p className="helper status-note" role="status">{connection || (stage < 3 && elapsed >= 60000 ? 'Taking a little longer. Keep this page open.' : stage < 3 && elapsed >= 10000 ? 'This usually takes a minute or two.' : '')}</p>
    <details className="waiting-help"><summary>What you’ll discover</summary><p className="helper">Your contribution, topics to build on, and people to meet. If posts aren’t available, we look at your profile.</p></details>
  </section>;
}
