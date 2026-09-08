import Image from 'next/image';

export default function BrandOrbit({ waiting = false }: { waiting?: boolean }) {
  return <div className={`brand-orbit ${waiting ? 'is-waiting' : ''}`}>
    <span className="brand-star star-one" aria-hidden="true">✦</span>
    <span className="brand-star star-two" aria-hidden="true">✦</span>
    <span className="brand-star star-three" aria-hidden="true">✧</span>
    <Image className={waiting ? 'turning-logo' : 'hero-logo'} src="/contentdc-logo.png" width={144} height={144} alt={waiting ? '' : 'ContentDC'} priority />
  </div>;
}
