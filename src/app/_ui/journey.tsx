'use client';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { readStatus, errorCopy } from './api';
const phrases = ['Starting your analysis', 'Reading your public posts', 'Finding your contribution signals', 'Your result is ready'];
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
        const data = await readStatus(id, controller.signal);
        if (stopped || controller.signal.aborted) return;
        if (data.status === 'failed') { stopped = true; setError(errorCopy(data.errorClass)); return; }
        reached = Math.max(reached, ['queued', 'fetching', 'scoring', 'complete'].indexOf(data.status));
        finished = data.status === 'complete';
        if (data.status === 'complete') setProfile(data.result.kind === 'profile');
        setConnection('');
      } catch (e) { if (!controller.signal.aborted) setConnection(e instanceof Error ? e.message : 'Reconnecting…'); }
      if (!stopped && !finished && !controller.signal.aborted) nextPoll = setTimeout(poll, 1500);
    }
    void poll();
    return () => { stopped = true; controller.abort(); clearInterval(clock); clearTimeout(nextPoll); };
  }, [id, router]);
  if (error) return <section className="journey fade-in"><h1>Let’s try again.</h1><p role="alert" className="helper">{error}</p><Link href="/" className="primary">Try again</Link></section>;
  return <section className="journey fade-in"><h1 key={stage} className="fade-in" role="status">{profile && stage === 2 ? 'Finding your profile signals' : phrases[stage]}</h1>
    <div className="waiting-card">{stage < 2 ? <Image className="turning-logo" src="/contentdc-logo.png" width={150} height={150} alt="" priority /> : <div className="signal-grid fade-in">{(profile ? ['Audience', 'Output', 'Activity', 'Topics'] : ['Topics', 'Depth', 'Streak', 'Reach']).map((label, i) => <div key={label}><span aria-hidden="true">{['✳', '▦', '⠿', '◌'][i]}</span>{label}</div>)}</div>}</div>
    <p className="helper status-note" role="status">{connection || (stage < 2 && elapsed >= 60000 ? 'Still collecting. Keep this page open.' : stage < 2 && elapsed >= 10000 ? 'This usually takes a minute or two.' : '')}</p>
    <details className="waiting-help"><summary>What counts?</summary><p className="helper">Topics, depth, streak, and public response in your recent posts. If posts aren’t available, we look at your profile.</p></details>
  </section>;
}
