import type { Metadata } from 'next';

import './globals.css';

export const metadata: Metadata = {
  title: 'Contribution Proof',
  description: 'See how your public work helps emerging technology get understood.',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
