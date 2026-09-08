'use client';
import { usePathname } from 'next/navigation';

export default function FlowSteps() {
  const path = usePathname();
  const current = path.startsWith('/result/') ? 3 : path.startsWith('/analyzing/') ? 2 : path.startsWith('/register/') ? 1 : 0;
  return <nav aria-label="Your journey"><ol className="flow-steps">{['Handle', 'Email', 'Analysis', 'Result'].map((label, index) => <li key={label} className={index < current ? 'done' : index === current ? 'current' : ''} aria-current={index === current ? 'step' : undefined}><span className="step-dot" aria-hidden="true">{index < current ? '✓' : index + 1}</span><span>{label}</span></li>)}</ol></nav>;
}
