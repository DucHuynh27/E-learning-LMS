import { Module } from '@nestjs/common';
import { CertificatesModule } from '../certificates/certificates.module.js';
import { LearningSupportModule } from '../learning/learning-support.module.js';
import { ProgressController } from './progress.controller.js';
import { ProgressService } from './progress.service.js';

@Module({
  imports: [LearningSupportModule, CertificatesModule],
  controllers: [ProgressController],
  providers: [ProgressService],
  exports: [ProgressService],
})
export class ProgressModule {}
