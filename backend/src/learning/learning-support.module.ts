import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogAccess } from './catalog-access.service.js';
import { PublishedLessonCache } from './published-lesson-cache.service.js';

@Module({
  imports: [ConfigModule],
  providers: [CatalogAccess, PublishedLessonCache],
  exports: [CatalogAccess, PublishedLessonCache],
})
export class LearningSupportModule {}
