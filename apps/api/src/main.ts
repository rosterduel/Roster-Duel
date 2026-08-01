// Must run before any other import touches process.env (e.g. ANTHROPIC_API_KEY
// in matches.service.ts) — Prisma loads its own .env internally for
// DATABASE_URL, but nothing else in this app does that automatically.
import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const port = process.env.PORT ?? 4000;
  await app.listen(port);
  // eslint-disable-next-line no-console
  console.log(`RosterDuel API listening on http://localhost:${port}`);
}
bootstrap();
