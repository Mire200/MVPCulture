'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useGameStore } from '@/store/gameStore';
import { getSocket } from '@/lib/socket';
import { motion, AnimatePresence } from 'framer-motion';
import { Heart, Bomb, AlertTriangle } from 'lucide-react';
import { AvatarBadge } from '@/components/AvatarPicker';
import { mvpSound } from '@/lib/sound';

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz'.split('');

export function BombpartyRound() {
  const snapshot = useGameStore((s) => s.snapshot);
  const myId = useGameStore((s) => s.playerId);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  
  const inputRef = useRef<HTMLInputElement>(null);

  if (!snapshot || !snapshot.round) return null;
  const r = snapshot.round;
  const cpId = r.currentPlayerId;
  const isMyTurn = cpId === myId;
  const timerMs = r.bpTimerMs ?? 10000;
  const endsAt = r.bpExplodesAt ?? 0;
  
  // Timer visual logic
  const [timeLeft, setTimeLeft] = useState(timerMs);
  useEffect(() => {
    let raf: number;
    const update = () => {
      const remaining = Math.max(0, endsAt - Date.now());
      setTimeLeft(remaining);
      if (remaining > 0) raf = requestAnimationFrame(update);
    };
    update();
    return () => cancelAnimationFrame(raf);
  }, [endsAt]);

  const progress = Math.max(0, Math.min(1, timeLeft / timerMs));
  const isDanger = timeLeft < 3000;

  // Auto-focus when it's my turn
  useEffect(() => {
    if (isMyTurn) {
      setErrorMsg('');
      inputRef.current?.focus();
    } else {
      setInput('');
      setErrorMsg('');
    }
  }, [isMyTurn]);

  // Audio heartbeat for bomb
  const playedTickRef = useRef<number>(0);
  useEffect(() => {
    if (timeLeft > 0 && timeLeft < 5000) {
      const secondFloor = Math.floor(timeLeft / 1000);
      if (playedTickRef.current !== secondFloor) {
        playedTickRef.current = secondFloor;
        // Play tick sound if we have one, mvpSound.pop() as a placeholder
        mvpSound.pop();
      }
    } else {
      playedTickRef.current = 0;
    }
    
    if (timeLeft === 0 && cpId === myId) {
       // Explosion for me
       mvpSound.fail();
    }
  }, [timeLeft, cpId, myId]);

  const handleSubmit = useCallback(
    (e?: React.FormEvent) => {
      if (e) e.preventDefault();
      if (!isMyTurn || sending || !input.trim()) return;
      setSending(true);
      setErrorMsg('');
      const sock = getSocket();
      sock.emit('round:answer', { text: input.trim() }, (res) => {
        setSending(false);
        if (res.ok) {
          const data = res.data as any;
          if (data?.error) {
            setErrorMsg(data.error);
            mvpSound.fail();
            inputRef.current?.select();
          } else if (data?.correct) {
            setInput('');
            mvpSound.success();
          }
        }
      });
    },
    [input, isMyTurn, sending],
  );

  const players = snapshot.players;
  const alphabets = r.bpAlphabets ?? {};
  const lives = r.bpLives ?? {};
  const myAlphabet = alphabets[myId ?? ''] ?? [];
  const myLives = lives[myId ?? ''] ?? 0;
  
  const currentPlayer = players.find((p) => p.id === cpId);
  const isEliminated = myId && myLives <= 0;

  return (
    <div className="flex flex-col md:flex-row gap-6 w-full max-w-6xl mx-auto h-[calc(100dvh-120px)] p-4">
      
      {/* ALPHABET SIDEBAR (Left) */}
      <div className="hidden md:flex flex-col w-64 bg-surface-elevated rounded-2xl p-4 border border-border shadow-xl">
        <h3 className="text-sm uppercase tracking-widest text-text-dim mb-4 text-center">Ton Alphabet</h3>
        <div className="grid grid-cols-4 gap-2">
          {ALPHABET.map(letter => {
            const isFound = myAlphabet.includes(letter);
            return (
              <div 
                key={letter}
                className={`aspect-square flex items-center justify-center rounded-lg text-lg font-display uppercase
                  ${isFound 
                    ? 'bg-neon-lime text-black shadow-[0_0_10px_rgba(163,230,53,0.5)]' 
                    : 'bg-surface-2 text-text-muted border border-border/50'}`}
              >
                {letter}
              </div>
            );
          })}
        </div>
        <div className="mt-6 text-center text-xs text-text-dim">
          Trouve les lettres manquantes pour gagner une vie !
        </div>
      </div>

      {/* CENTER: BOMB & INPUT */}
      <div className="flex-1 flex flex-col items-center justify-center relative">
        
        {/* Opponent's turn info */}
        <div className="mb-8 text-center h-12">
          {!isMyTurn && currentPlayer && (
            <div className="animate-pulse text-lg font-medium text-text-muted">
              Au tour de <span className="text-white font-bold">{currentPlayer.nickname}</span>...
            </div>
          )}
          {isMyTurn && (
             <div className="text-xl font-display text-neon-cyan drop-shadow-[0_0_8px_rgba(34,211,238,0.8)]">
               C'est à toi !
             </div>
          )}
          {isEliminated && (
            <div className="text-neon-rose font-display">Tu es éliminé 💀</div>
          )}
        </div>

        {/* The Bomb */}
        <motion.div 
          className="relative flex items-center justify-center w-64 h-64 bg-black rounded-full shadow-[0_0_40px_rgba(0,0,0,0.8)] border-[6px] border-surface-2"
          animate={{
             scale: isDanger ? [1, 1.05, 1] : 1,
             rotate: isDanger ? [-2, 2, -2] : 0,
          }}
          transition={{
             repeat: Infinity,
             duration: isDanger ? 0.3 : 1
          }}
        >
           {/* Fuse spark */}
           {timeLeft > 0 && (
             <motion.div 
               className="absolute top-0 right-1/4 w-4 h-4 rounded-full bg-orange-500 shadow-[0_0_20px_#f97316]"
               animate={{ opacity: [1, 0.5, 1], scale: [1, 1.5, 1] }}
               transition={{ repeat: Infinity, duration: 0.1 }}
             />
           )}
           
           <div className="absolute inset-4 rounded-full border-4 border-surface-elevated/30 flex items-center justify-center pointer-events-none">
              <div className="text-center">
                 <div className="text-xs text-text-dim uppercase tracking-widest mb-2">Syllabe</div>
                 <div className="text-6xl font-display font-black text-white drop-shadow-lg tracking-wider">
                   {r.bpSyllable}
                 </div>
              </div>
           </div>

           {/* Circular progress bar */}
           <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 100 100">
             <circle 
               cx="50" cy="50" r="46" 
               fill="none" 
               stroke={isDanger ? '#f43f5e' : '#a3e635'} 
               strokeWidth="4" 
               strokeDasharray="289"
               strokeDashoffset={289 * (1 - progress)}
               className="transition-all duration-100 ease-linear"
             />
           </svg>
        </motion.div>

        {/* Input area */}
        <div className="mt-12 w-full max-w-sm">
           <form onSubmit={handleSubmit} className="relative">
             <input
               ref={inputRef}
               type="text"
               value={input}
               onChange={(e) => setInput(e.target.value.toUpperCase())}
               disabled={!isMyTurn || sending}
               placeholder={isMyTurn ? "Tape un mot..." : "Attends ton tour..."}
               className={`w-full h-16 rounded-2xl bg-surface-elevated border-2 text-center text-2xl font-display uppercase tracking-widest outline-none transition
                  ${isMyTurn ? 'border-neon-cyan text-white shadow-[0_0_15px_rgba(34,211,238,0.3)]' : 'border-border text-text-dim'}
                  ${errorMsg ? 'border-neon-rose text-neon-rose bg-neon-rose/10 animate-shake' : ''}
               `}
               autoComplete="off"
               spellCheck={false}
             />
             {errorMsg && (
                <div className="absolute -bottom-8 left-0 right-0 text-center text-sm font-medium text-neon-rose flex items-center justify-center gap-1">
                   <AlertTriangle className="w-4 h-4" />
                   {errorMsg}
                </div>
             )}
           </form>
        </div>

      </div>

      {/* PLAYERS LIST (Right) */}
      <div className="w-full md:w-64 bg-surface-elevated rounded-2xl p-4 border border-border shadow-xl overflow-y-auto">
        <h3 className="text-sm uppercase tracking-widest text-text-dim mb-4 text-center">Joueurs</h3>
        <div className="flex flex-col gap-3">
          <AnimatePresence>
            {players.map(p => {
              const pLives = lives[p.id] ?? 0;
              const isCurrent = p.id === cpId;
              const dead = pLives <= 0;
              return (
                <motion.div 
                  key={p.id}
                  layout
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className={`flex items-center gap-3 p-2 rounded-xl transition
                     ${isCurrent ? 'bg-surface-2 ring-1 ring-white/20' : ''}
                     ${dead ? 'opacity-40 grayscale' : ''}
                  `}
                >
                  <AvatarBadge avatar={p.avatar} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate text-sm">{p.nickname}</div>
                    <div className="flex gap-1 mt-1">
                       {Array.from({ length: Math.max(1, pLives) }).map((_, i) => (
                         <Heart 
                           key={i} 
                           className={`w-4 h-4 ${pLives > 0 ? 'fill-neon-rose text-neon-rose' : 'text-text-muted'}`} 
                         />
                       ))}
                       {dead && <span className="text-xs text-text-dim ml-1">Éliminé</span>}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      </div>
      
    </div>
  );
}
