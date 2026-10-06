import type { FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import type { PrismaClient } from '../lib/prisma.js';

declare module 'fastify' {
  interface FastifyInstance {
    prisma: PrismaClient;
  }
}

/** Expose le client Prisma via `app.prisma` et le déconnecte à l'arrêt du serveur. */
export const prismaPlugin = fp(
  async (app: FastifyInstance, { prisma }: { prisma: PrismaClient }) => {
    app.decorate('prisma', prisma);
    app.addHook('onClose', async () => {
      await prisma.$disconnect();
    });
  },
);
