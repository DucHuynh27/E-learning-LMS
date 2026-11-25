import { Lesson, LessonType } from '../lesson.entity.js';

export interface LessonResponse {
  id: string;
  sectionId: string;
  title: string;
  type: LessonType;
  position: number;
  durationSec: number;
  isPublished: boolean;
}

export function toLessonResponse(lesson: Lesson): LessonResponse {
  return {
    id: lesson.id,
    sectionId: lesson.sectionId,
    title: lesson.title,
    type: lesson.type,
    position: lesson.position,
    durationSec: lesson.durationSec,
    isPublished: lesson.isPublished,
  };
}
