import { Module } from '@nestjs/common';
import { ProgressModule } from '../progress/progress.module.js';
import { CertificatesModule } from '../certificates/certificates.module.js';
import { QuizzesModule } from '../quizzes/quizzes.module.js';
import { AttemptsModule } from '../attempts/attempts.module.js';
import { HealthModule } from '../health/health.module.js';

@Module({
  imports: [
    ProgressModule,
    CertificatesModule,
    QuizzesModule,
    AttemptsModule,
    HealthModule,
  ],
  exports: [
    ProgressModule,
    CertificatesModule,
    QuizzesModule,
    AttemptsModule,
    HealthModule,
  ],
})
export class LearningModule {}
