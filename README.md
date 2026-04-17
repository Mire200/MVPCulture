# MVP Culture — Party Quiz Multijoueur

Plateforme web de quiz de culture générale multijoueur, pensée pour jouer entre amis dans des salons privés. Dark mode néon, 7 modes prévus (3 au MVP), moment social fort autour de la révélation et de la validation par l'hôte.

## Monorepo

- `apps/web` — Frontend Next.js (App Router, TypeScript, Tailwind, Framer Motion).
- `apps/realtime` — Serveur temps-réel Node.js + Socket.IO (machine à états par salon).
- `packages/shared` — Contrats partagés (types, schémas Zod, events, scoring).
- `packages/db` — Prisma schema + seed scripts.
- `packages/content` — Banque de questions JSON + pipeline IA (stub Phase 2).

## Prérequis

- Node.js >= 20
- pnpm >= 10
- PostgreSQL (local ou Neon)

## Démarrage rapide

```bash
pnpm install
cp .env.example .env   # puis ajuster DATABASE_URL si besoin
pnpm --filter @mvpc/db prisma:push
pnpm seed
pnpm dev
```

- Frontend : http://localhost:3000
- Realtime : http://localhost:4000

## Modes au MVP

1. Question ouverte classique (saisie libre, pas de bonus de vitesse, validation hôte).
2. Estimation numérique (plus proche = plus de points).
3. Liste en tour par tour (élimination si doublon / erreur / timeout).

Modes 4 à 7 (Patate chaude, Rapidité éliminatoire, Carte, Chronologie) : interface `GameMode` déjà prête, implémentation en phase 2.

## Scoring

La vitesse n'intervient **jamais** dans le mode classique. Elle n'est utilisée que par les modes qui la déclarent explicitement (`scoring.usesSpeed`). Voir `packages/shared/src/scoring.ts`.

## Déploiement

- Front → Vercel
- Realtime → Fly.io ou Railway (sticky sessions)
- DB → Neon

Voir `docs/DEPLOY.md`.
