import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __mvpcPrisma: PrismaClient | undefined;
}

export const prisma =
  global.__mvpcPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  global.__mvpcPrisma = prisma;
}

export * from '@prisma/client';
