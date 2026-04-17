'use client';
import Image from 'next/image';

export function TastyLogo() {
  return (
    <div className="tasty-logo" aria-hidden="true">
      <span className="tasty-tag">presented by</span>
      <Image
        src="/avatars/tastycrousty.webp"
        alt="Tasty Crousty"
        width={108}
        height={108}
        priority
      />
    </div>
  );
}
