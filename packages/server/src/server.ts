import 'dotenv/config';
import { buildApp } from './app.js';
import { loadEnv } from './config/env.js';

const env = loadEnv();
const app = await buildApp(env);

// Arrêt propre (Ctrl+C en local, redéploiement sur Render).
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, () => {
    app.log.info(`${signal} reçu, arrêt du serveur`);
    void app.close().then(() => process.exit(0));
  });
}

try {
  await app.listen({ host: env.HOST, port: env.PORT });
  app.log.info(`Documentation de l'API : http://localhost:${env.PORT}/docs`);
} catch (error) {
  app.log.fatal(error);
  process.exit(1);
}
