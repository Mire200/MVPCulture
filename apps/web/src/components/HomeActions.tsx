'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Sparkles, LogIn } from 'lucide-react';
import { motion } from 'framer-motion';
import { mvpSound } from '@/lib/sound';

export function HomeActions() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const onCreate = () => {
    mvpSound.pop();
    setLoading(true);
    router.push('/play/new');
  };

  const onJoin = () => {
    const c = code.trim().toUpperCase();
    if (c.length === 5) {
      mvpSound.click();
      router.push(`/r/${c}`);
    }
  };

  return (
    <div className="flex flex-col sm:flex-row gap-4 justify-center items-stretch">
      <motion.button
        whileHover={{ y: -2 }}
        whileTap={{ scale: 0.97 }}
        onClick={onCreate}
        disabled={loading}
        className="btn-primary text-lg px-8 py-4 min-w-[220px]"
      >
        <Sparkles className="w-5 h-5" />
        Créer un salon
      </motion.button>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          onJoin();
        }}
        className="flex items-stretch gap-2"
      >
        <input
          type="text"
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder="CODE"
          maxLength={5}
          className="input font-mono tracking-[0.3em] text-center text-lg w-[180px] uppercase"
        />
        <button
          type="submit"
          disabled={code.length !== 5}
          className="btn-ghost disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <LogIn className="w-4 h-4" />
          Rejoindre
        </button>
      </form>
    </div>
  );
}
