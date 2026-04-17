'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { mvpSound } from '@/lib/sound';

export function LandingHeroCta() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const onCreate = () => {
    mvpSound.pop();
    setLoading(true);
    router.push('/play/new');
  };

  const onJoin = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 5) {
      mvpSound.click();
      router.push(`/r/${code}`);
    }
  };

  return (
    <div className="landing-cta-row">
      <button
        type="button"
        className="landing-btn-primary"
        onClick={onCreate}
        disabled={loading}
      >
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M12 3v3m0 12v3M3 12h3m12 0h3M5.6 5.6l2.1 2.1m8.6 8.6l2.1 2.1M5.6 18.4l2.1-2.1m8.6-8.6l2.1-2.1" />
        </svg>
        Créer un salon
      </button>

      <form className="landing-join-form" onSubmit={onJoin}>
        <input
          className="landing-input-code"
          value={code}
          onChange={(e) =>
            setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 5))
          }
          placeholder="CODE"
          maxLength={5}
          autoComplete="off"
          aria-label="Code du salon"
        />
        <button
          type="submit"
          className="landing-btn-secondary"
          disabled={code.length !== 5}
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden
          >
            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
            <polyline points="10 17 15 12 10 7" />
            <line x1="15" y1="12" x2="3" y2="12" />
          </svg>
          Rejoindre
        </button>
      </form>
    </div>
  );
}
