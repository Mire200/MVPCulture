/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['@mvpc/shared', '@mvpc/content'],
  // Sortie "standalone" pour déploiement Docker/Railway : next copie uniquement
  // ce dont l'app a besoin à l'exécution.
  output: 'standalone',
  experimental: {
    externalDir: true,
  },
};

module.exports = nextConfig;
