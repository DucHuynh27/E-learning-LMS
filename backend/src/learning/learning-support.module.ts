import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { CatalogAccess } from './catalog-access.service.js';

@Module({
  imports: [ConfigModule],
  providers: [CatalogAccess],
  exports: [CatalogAccess],
})
export class LearningSupportModule {}
