import Image from 'next/image';
import Link from 'next/link';
import { CATALOG, type Project } from '@/lib/catalog';
import type { PublicResult } from '@/lib/result';
import { labelForTopic } from '@/lib/taxonomy';
import logos from '../../../public/company-logos/sources.json';

const logoFor = (id: string) => Object.entries(logos).find(([key]) => key === id)?.[1].path;
const usable = (project: Project) => Boolean(logoFor(project.id)) && /^https:\/\//.test(project.url);

export function ResultTabs({ id, view }: { id: string; view: 'card' | 'trends' }) {
  const base = `/result/${encodeURIComponent(id)}`;
  return <nav className="result-tabs" aria-label="Result pages">
    <Link href={base} aria-current={view === 'card' ? 'page' : undefined}>My card</Link>
    <Link href={`${base}?view=trends`} aria-current={view === 'trends' ? 'page' : undefined}>Trends</Link>
  </nav>;
}

export default function Recommendations({ result }: { result: PublicResult }) {
  // Keep topic matches first. Fill gaps with explicitly general suggestions, never fake matches.
  const candidates = [
    ...result.opportunities.filter(match => usable(match.project)).map(match => ({ project: match.project, overlap: match.overlap })),
    ...CATALOG.filter(project => usable(project) && !project.unverified).map(project => ({ project, overlap: Array<string>() })),
  ];
  const cards = candidates.filter((item, index) => candidates.findIndex(other => other.project.id === item.project.id) === index).slice(0, 3);
  return <div className="recommendations fade-in">
    <div className="opportunity-intro"><span aria-hidden="true" className="reward-star">✦</span>
      <p className="eyebrow">Trends to explore</p><h1>Your next chapter</h1>
      <p className="helper">Three companies. New directions.</p>
    </div>
    <div className="company-list">{cards.map(({ project, overlap }, index) => <a className="company-card" href={project.url} target="_blank" rel="noreferrer" key={project.id}>
      <div className="company-top"><div className="company-logo"><Image src={logoFor(project.id)!} width={48} height={48} unoptimized alt={`${project.name} logo`} /></div>
        <div><p className="company-kicker">{overlap.length ? 'Based on your topics' : 'Also worth exploring'}</p><h2>{project.name}</h2></div><span className="company-arrow" aria-hidden="true">↗</span>
      </div>
      <p className="company-session">{project.session}</p>
      <div className="company-bottom"><span className="company-topic">{overlap.length ? labelForTopic(overlap[0]) : 'Discover the company'}</span><span className="company-number" aria-hidden="true">0{index + 1}</span></div>
      {project.sponsor && <small className="helper">Sponsored</small>}
    </a>)}</div>
    <section className="contentdc-offer"><Image src="/contentdc-logo.png" alt="ContentDC" width={42} height={42} />
      <h2>Turn contribution into opportunity.</h2>
      <a className="primary" href="https://contentdc.com" target="_blank" rel="noreferrer">Get access to paid offers on ContentDC ↗</a>
    </section>
  </div>;
}
