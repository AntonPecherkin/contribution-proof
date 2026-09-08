import Image from 'next/image';
import Link from 'next/link';
export default function Shell({ children, back = false }: { children: React.ReactNode; back?: boolean }) {
  return <div className="app"><header>{back ? <Link className="back" href="/" aria-label="Start again">←</Link> : <span />}<Image src="/contentdc-logo.png" width={36} height={36} alt="ContentDC" priority /></header><main>{children}</main></div>;
}
