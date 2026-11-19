import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { UpdateProgressDto } from '../progress/dto/update-progress.dto.js';
import { CreateQuizDto } from '../quizzes/dto/create-quiz.dto.js';
import { SubmitAttemptDto } from '../attempts/dto/submit-attempt.dto.js';
import { LessonParamsDto } from './dto/learning-params.dto.js';
import { ConfigService } from '@nestjs/config';
import { LearningInfrastructureDto } from './dto/learning-infrastructure.dto.js';

const pipe = new ValidationPipe({
  transform: true,
  whitelist: true,
  forbidNonWhitelisted: true,
});
const validate = (body: unknown, metatype: new () => object) =>
  pipe.transform(body, { type: 'body', metatype });

describe('Learning request validation', () => {
  it.each([-1, 0.9, '90', null, 2147483648])(
    'rejects watchedSec %s',
    async (watchedSec) => {
      await expect(
        validate({ watchedSec }, UpdateProgressDto),
      ).rejects.toThrow();
    },
  );
  it('accepts zero seconds and rejects client-supplied completion', async () => {
    await expect(
      validate({ watchedSec: 0 }, UpdateProgressDto),
    ).resolves.toMatchObject({ watchedSec: 0 });
    await expect(
      validate({ watchedSec: 90, completed: true }, UpdateProgressDto),
    ).rejects.toThrow();
  });
  it('validates nested quiz options and trims question content', async () => {
    const quiz = {
      passScore: 70,
      questions: [
        {
          content: '  Q?  ',
          options: [
            { content: ' A ', isCorrect: true },
            { content: 'B', isCorrect: false },
          ],
        },
      ],
    };
    await expect(validate(quiz, CreateQuizDto)).resolves.toMatchObject({
      questions: [
        { content: 'Q?', options: [{ content: 'A' }, { content: 'B' }] },
      ],
    });
    await expect(
      validate(
        {
          ...quiz,
          questions: [
            { content: 'Q?', options: [{ content: 'A', isCorrect: 'true' }] },
          ],
        },
        CreateQuizDto,
      ),
    ).rejects.toThrow();
    await expect(
      validate({ ...quiz, passScore: 101 }, CreateQuizDto),
    ).rejects.toThrow();
    await expect(
      validate({ ...quiz, questions: [] }, CreateQuizDto),
    ).rejects.toThrow();
  });
  it('rejects duplicate question IDs, including mixed UUID case', async () => {
    const questionId = randomUUID();
    await expect(
      validate(
        { answers: [{ questionId }, { questionId: questionId.toUpperCase() }] },
        SubmitAttemptDto,
      ),
    ).rejects.toThrow();
  });
  it.each([
    { answers: [null] },
    { answers: [{}] },
    { answers: [{ questionId: 10 }] },
    { answers: 'invalid' },
    {},
  ])(
    'rejects malformed submissions without crashing validation',
    async (body) => {
      await expect(validate(body, SubmitAttemptDto)).rejects.toMatchObject({
        status: 400,
      });
    },
  );
  it('accepts unanswered questions but rejects a client-supplied score', async () => {
    await expect(
      validate({ answers: [{ questionId: randomUUID() }] }, SubmitAttemptDto),
    ).resolves.toBeInstanceOf(SubmitAttemptDto);
    await expect(
      validate({ answers: [], score: 100 }, SubmitAttemptDto),
    ).rejects.toThrow();
  });
  it('rejects invalid lesson path parameters', async () => {
    await expect(
      validate({ lessonId: 'not-a-uuid' }, LessonParamsDto),
    ).rejects.toThrow();
  });
  it('validates infrastructure values without leaking secret values in errors', () => {
    expect(() =>
      LearningInfrastructureDto.from(
        new ConfigService({ REDIS_PORT: 70000, REDIS_PASSWORD: 'test-secret' }),
      ),
    ).toThrow('Invalid Learning infrastructure configuration');
    expect(
      LearningInfrastructureDto.from(new ConfigService({ REDIS_PORT: 6379 }))
        .redisPort,
    ).toBe(6379);
  });
});
