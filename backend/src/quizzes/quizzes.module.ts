import { Module } from '@nestjs/common';
import { LearningSupportModule } from '../learning/learning-support.module.js';
import { QuizzesController } from './quizzes.controller.js';
import { QuizzesService } from './quizzes.service.js';

@Module({
  imports: [LearningSupportModule],
  controllers: [QuizzesController],
  providers: [QuizzesService],
  exports: [QuizzesService],
})
export class QuizzesModule {}
