import { createApp } from './app.js';
import path from 'node:path';

const port = Number(process.env.PORT ?? 4173);
const dbPath = process.env.SERVERLENS_DB_PATH ?? path.resolve('data/serverlens.sqlite');
const app = createApp({ dbPath });
const server = await app.listen(port);
const boundHost = process.env.SERVERLENS_BIND_HOST ?? '127.0.0.1';

console.log(`ServerLens is running at http://${boundHost}:${port}`);
if (boundHost === '127.0.0.1') {
  console.log('Bound to loopback only. Set SERVERLENS_BIND_HOST to expose the local API on other interfaces.');
}
if (process.env.SERVERLENS_API_TOKEN) {
  console.log('API token enforcement is enabled for write requests.');
}

process.on('SIGINT', () => {
  server.close(() => {
    app.store.close();
    process.exit(0);
  });
});
