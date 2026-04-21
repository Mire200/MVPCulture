'use client';
import { getSocket } from '@/lib/socket';
import { AvatarBadge } from '@/components/AvatarPicker';
import { Crown, Eye, Sparkles, Users } from 'lucide-react';
import type { CodenamesTeam, Player } from '@mvpc/shared';
import { motion } from 'framer-motion';

interface Props {
  players: Player[];
  myId: string | null;
}

const TEAM_LABEL: Record<CodenamesTeam, string> = {
  red: 'Équipe Rouge',
  blue: 'Équipe Bleu',
  spectator: 'Spectateurs',
};

const TEAM_ACCENT: Record<CodenamesTeam, string> = {
  red: 'border-neon-rose/50 bg-neon-rose/5',
  blue: 'border-neon-cyan/50 bg-neon-cyan/5',
  spectator: 'border-border bg-bg-soft/40',
};

const TEAM_CHIP: Record<CodenamesTeam, string> = {
  red: 'chip-rose',
  blue: 'chip-cyan',
  spectator: 'chip',
};

function setTeam(team: CodenamesTeam) {
  const sock = getSocket();
  sock.emit('lobby:codenames:setTeam', { team }, (res) => {
    if (!res.ok) alert(res.message);
  });
}

function setSpymaster(wants: boolean) {
  const sock = getSocket();
  sock.emit('lobby:codenames:setSpymaster', { wants }, (res) => {
    if (!res.ok) alert(res.message);
  });
}

export function CodenamesLobbyPanel({ players, myId }: Props) {
  const me = myId ? players.find((p) => p.id === myId) : undefined;
  const myTeam: CodenamesTeam = (me?.cnTeam as CodenamesTeam | undefined) ?? 'spectator';
  const iAmSpymaster = !!me?.cnWantsSpymaster;

  const byTeam: Record<CodenamesTeam, Player[]> = {
    red: players.filter((p) => p.cnTeam === 'red'),
    blue: players.filter((p) => p.cnTeam === 'blue'),
    spectator: players.filter((p) => !p.cnTeam || p.cnTeam === 'spectator'),
  };

  return (
    <section className="panel p-6 space-y-5">
      <div className="flex items-center gap-2 flex-wrap">
        <Users className="w-5 h-5 text-neon-cyan" />
        <h2 className="font-display text-xl font-semibold">Équipes Codenames</h2>
        <span className="text-[11px] text-text-dim uppercase tracking-[0.1em]">
          choisis ta place et toggle spymaster
        </span>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['red', 'spectator', 'blue'] as CodenamesTeam[]).map((team) => {
          const entries = byTeam[team];
          const mine = myTeam === team;
          return (
            <div
              key={team}
              className={`panel-elevated p-4 rounded-xl border ${TEAM_ACCENT[team]} space-y-3 min-h-[180px]`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className={TEAM_CHIP[team]}>{TEAM_LABEL[team]}</span>
                <span className="text-xs text-text-dim font-mono">{entries.length}</span>
              </div>

              <ul className="space-y-1.5">
                {entries.length === 0 && (
                  <li className="text-xs text-text-dim italic">—</li>
                )}
                {entries.map((p) => {
                  const isSpy = !!p.cnWantsSpymaster && (team === 'red' || team === 'blue');
                  return (
                    <li
                      key={p.id}
                      className="flex items-center gap-2 text-sm"
                    >
                      <AvatarBadge avatar={p.avatar} size="sm" />
                      <span className="truncate flex-1">{p.nickname}</span>
                      {isSpy && (
                        <span
                          title="Volontaire spymaster"
                          className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-neon-amber"
                        >
                          <Crown className="w-3 h-3" />
                          spy
                        </span>
                      )}
                      {p.id === myId && (
                        <span className="text-[10px] uppercase tracking-wider text-text-dim">
                          toi
                        </span>
                      )}
                    </li>
                  );
                })}
              </ul>

              <div className="pt-2 border-t border-border/60 space-y-2">
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  type="button"
                  disabled={mine}
                  onClick={() => setTeam(team)}
                  className={
                    mine
                      ? 'chip opacity-60 w-full justify-center'
                      : `${TEAM_CHIP[team]} w-full justify-center hover:brightness-110`
                  }
                >
                  {mine ? (
                    <>
                      <Eye className="w-3 h-3" />
                      Tu es ici
                    </>
                  ) : (
                    `Rejoindre ${team === 'spectator' ? 'les spectateurs' : team === 'red' ? 'Rouge' : 'Bleu'}`
                  )}
                </motion.button>
                {mine && (team === 'red' || team === 'blue') && (
                  <motion.button
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={() => setSpymaster(!iAmSpymaster)}
                    className={`${iAmSpymaster ? 'chip-amber' : 'chip'} w-full justify-center`}
                    title="Si plusieurs volontaires, le spymaster est tiré au sort"
                  >
                    <Sparkles className="w-3 h-3" />
                    {iAmSpymaster ? 'Je retire ma candidature' : 'Je suis spymaster'}
                  </motion.button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-text-dim">
        Il faut au moins 2 joueurs par équipe. Un spymaster est désigné automatiquement au lancement
        (parmi les volontaires si présents).
      </p>
    </section>
  );
}
