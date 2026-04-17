# Déploiement

Trois cibles recommandées pour une stack sobre et peu coûteuse :

| Composant     | Cible conseillée           | Pourquoi                                                  |
| ------------- | -------------------------- | --------------------------------------------------------- |
| `apps/web`    | **Vercel**                 | App Router natif, Edge/CDN, preview URLs                  |
| `apps/realtime` | **Fly.io** ou **Railway** | WebSocket persistants avec sticky sessions                |
| PostgreSQL    | **Neon**                   | Serverless, free tier confortable, branches par environnement |

## 1. Frontend — Vercel

1. Importer le dépôt sur Vercel.
2. Project Root : `apps/web`.
3. Build command : `cd ../.. && pnpm install --frozen-lockfile && pnpm --filter @mvpc/web build`.
4. Install command : `pnpm install --frozen-lockfile` (Vercel gère pnpm automatiquement si `packageManager` est présent à la racine, ce qui est notre cas).
5. Variables d'environnement :
   - `NEXT_PUBLIC_REALTIME_URL` → URL publique du serveur realtime (`wss://...`).
   - `NEXT_PUBLIC_APP_URL` → URL publique de l'app.

Astuce : dans Vercel → Project Settings → General, définir « Root Directory » à `apps/web`
et cocher « Include files outside of Root Directory » pour que Vercel monorepo fonctionne.

## 2. Realtime — Fly.io

```bash
cd apps/realtime
fly launch --no-deploy       # choisir une région proche (cdg, ams, …)
fly secrets set \
  REALTIME_HOST_SECRET="$(openssl rand -hex 32)" \
  REALTIME_CORS_ORIGIN="https://mvpc.vercel.app" \
  DATABASE_URL="postgres://…neon…"
fly deploy
```

Un `Dockerfile` minimal est fourni dans `apps/realtime/Dockerfile` (build TS → `node dist/index.js`).

**Important** : pour du WebSocket correct côté Fly, activer `auto_start_machines = true` et
garder au moins une machine `min_machines_running = 1` si l'on veut éviter les cold-starts.

### Sticky sessions / scaling

- **1 instance** : aucune configuration particulière.
- **Plusieurs instances** : brancher l'adapter Redis officiel de Socket.IO
  (`@socket.io/redis-adapter`) et un Upstash Redis. Sticky sessions activés au niveau du LB
  (Fly le fait par défaut via `x-forwarded-for`).

## 3. Railway (alternative au Fly.io)

```bash
cd apps/realtime
railway init
railway variables set REALTIME_HOST_SECRET=... REALTIME_CORS_ORIGIN=https://mvpc.vercel.app
railway up
```

Railway expose une URL HTTPS automatique.

## 4. Base de données — Neon

1. Créer un projet Neon.
2. Copier la connection string `DATABASE_URL` (variante "pooler").
3. Depuis la racine : `pnpm --filter @mvpc/db prisma:push` pour créer les tables.
4. `pnpm seed` pour charger la banque de questions initiale.

## Variables d'environnement — récapitulatif

| Variable                    | Scope        | Exemple                            |
| --------------------------- | ------------ | ---------------------------------- |
| `DATABASE_URL`              | realtime, db | `postgres://user:pwd@host/db`      |
| `REALTIME_PORT`             | realtime     | `4000`                             |
| `REALTIME_HOST_SECRET`      | realtime     | `openssl rand -hex 32`             |
| `REALTIME_CORS_ORIGIN`      | realtime     | `https://mvpc.vercel.app`          |
| `NEXT_PUBLIC_REALTIME_URL`  | web          | `https://realtime.mvpc.app`        |
| `NEXT_PUBLIC_APP_URL`       | web          | `https://mvpc.vercel.app`          |

## Build local (sanity check avant deploy)

```bash
pnpm install
pnpm --filter @mvpc/web build
pnpm --filter @mvpc/realtime build
```
