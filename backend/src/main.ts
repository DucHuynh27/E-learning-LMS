import { NestFactory } from '@nestjs/core';
import { AppModule, ObserveInstrument } from './app.module.js';
import { configureApp } from './bootstrap.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    instrument: ObserveInstrument,
  });

  configureApp(app);
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
