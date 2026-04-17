// En prod (Railway, Fly, Render...) l'hébergeur impose le port via `PORT`.
// En local on utilise REALTIME_PORT pour ne pas marcher sur celui du web.
const rawPort = process.env.PORT ?? process.env.REALTIME_PORT ?? '4000';

export const config = {
  port: parseInt(rawPort, 10),
  corsOrigin: (process.env.REALTIME_CORS_ORIGIN ?? 'http://localhost:3000')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),
  hostSecret: process.env.REALTIME_HOST_SECRET ?? 'dev-secret-change-me-32bytes-min',
};
