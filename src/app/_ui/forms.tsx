'use client';
import { useState } from 'react';
import BrandOrbit from './brand-orbit';
import { useRouter } from 'next/navigation';
import { normalizeHandle, normalizeEmail } from '@/lib/normalize';
export default function EntryForm({ id }: { id?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const register = !!id;
  return <form className="entry fade-in" onSubmit={async event => {
    event.preventDefault(); if (busy) return;
    const form = new FormData(event.currentTarget);
    const input = String(form.get('value') ?? '');
    const optIn = form.get('board') === 'on';
    const value = register ? normalizeEmail(input) : normalizeHandle(input);
    if (!value) { setError(register ? 'Enter a valid email.' : 'Check your X handle.'); return; }
    setBusy(true); setError('');
    try {
      const response = await fetch(register ? '/api/participants' : '/api/analyses', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(register ? { analysisId: id, email: value, consentVersion: 'explicit-early-access-button-v1', boardOptIn: optIn } : { handle: value, consentVersion: 'explicit-analysis-button-v1' }),
        signal: AbortSignal.timeout(20000),
      });
      if (!response.ok) throw new Error(response.status === 429 ? 'Too many requests. Try again shortly.' : 'Couldn’t continue. Please try again.');
      const data: unknown = await response.json();
      if (register) router.push(`/analyzing/${encodeURIComponent(id)}`);
      else {
        if (!data || typeof data !== 'object' || !('id' in data) || typeof data.id !== 'string') throw new Error('Couldn’t start. Please try again.');
        router.push(`/register/${encodeURIComponent(data.id)}`);
      }
    } catch (e) { setError(e instanceof Error ? e.message : 'Connection interrupted. Try again.'); setBusy(false); }
  }}>
    <div className="entry-fields"><BrandOrbit /><h1><label htmlFor="value">{register ? 'Your email' : 'Discover your contribution'}</label></h1>
      <input id="value" name="value" aria-label={register ? 'Your email' : 'Your X handle'} type={register ? 'email' : 'text'} placeholder={register ? 'you@email.com' : '@yourname'} autoComplete={register ? 'email' : 'off'} autoCapitalize="none" spellCheck={false} required aria-describedby="consent" />
      <p id="consent" className="helper">{register ? 'We’ll email you when early access opens.' : 'Find topics to build on and people to meet.'}</p>
      {error && <p role="alert" className="error">{error}</p>}
    </div>
    <button type="submit" className="primary" disabled={busy}>{busy ? 'One moment…' : register ? 'Agree & join early access' : 'Analyze my public posts'}</button>
  </form>;
}
