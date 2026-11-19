import { LessonProgress } from '../progress/lesson-progress.entity.js';
import { Certificate } from '../certificates/certificate.entity.js';
import { Quiz, Question, Option } from '../quizzes/quiz.entity.js';
import { QuizAttempt, QuizAnswer } from '../attempts/quiz-attempt.entity.js';

export const LEARNING_ENTITIES = [
  LessonProgress,
  Certificate,
  Quiz,
  Question,
  Option,
  QuizAttempt,
  QuizAnswer,
];
