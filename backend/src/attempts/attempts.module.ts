import { Module } from '@nestjs/common';
import { LearningSupportModule } from '../learning/learning-support.module.js';
import { QuizzesModule } from '../quizzes/quizzes.module.js';
import { AttemptsController } from './attempts.controller.js';
import { AttemptsService } from './attempts.service.js';

@Module({
  imports: [LearningSupportModule, QuizzesModule],
  controllers: [AttemptsController],
  providers: [AttemptsService],
  exports: [AttemptsService],
})
export class AttemptsModule {}
