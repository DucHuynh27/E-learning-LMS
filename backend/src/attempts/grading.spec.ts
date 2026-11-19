import 'reflect-metadata';
import { gradeAnswers } from './attempts.service.js';
import type { QuestionWithOptions } from '../quizzes/quizzes.service.js';

const questions: QuestionWithOptions[] = ['q1', 'q2', 'q3'].map(
  (id, position) => ({
    id,
    quizId: 'quiz',
    content: id,
    position,
    options: [
      {
        id: `${id}-right`,
        questionId: id,
        content: 'Yes',
        position: 0,
        isCorrect: true,
      },
      {
        id: `${id}-wrong`,
        questionId: id,
        content: 'No',
        position: 1,
        isCorrect: false,
      },
    ],
  }),
);

describe('Server-side quiz grading', () => {
  it('uses every stored question in the denominator', () => {
    expect(
      gradeAnswers(questions, [{ questionId: 'q1', optionId: 'q1-right' }]),
    ).toBe(33);
    expect(gradeAnswers(questions, [])).toBe(0);
  });
  it('grades correct, wrong and omitted answers', () => {
    expect(
      gradeAnswers(questions, [
        { questionId: 'q1', optionId: 'q1-right' },
        { questionId: 'q2', optionId: 'q2-wrong' },
        { questionId: 'q3' },
      ]),
    ).toBe(33);
    expect(
      gradeAnswers(
        questions,
        questions.map((q) => ({ questionId: q.id, optionId: `${q.id}-right` })),
      ),
    ).toBe(100);
  });
  it('rejects duplicate questions and foreign options/questions', () => {
    expect(() =>
      gradeAnswers(questions, [{ questionId: 'q1' }, { questionId: 'Q1' }]),
    ).toThrow('Duplicate');
    expect(() => gradeAnswers(questions, [{ questionId: 'other' }])).toThrow(
      'outside',
    );
    expect(() =>
      gradeAnswers(questions, [{ questionId: 'q1', optionId: 'q2-right' }]),
    ).toThrow('does not belong');
  });
});
