import { NestFactory } from '@nestjs/core';
import { MediaWorkerModule } from './media-worker.module.js';

await NestFactory.createApplicationContext(MediaWorkerModule);
