import { Section } from '../section.entity.js';
import type { LessonResponse } from '../../lessons/dto/lesson.response.js';

export interface SectionResponse {
  id: string;
  courseId: string;
  title: string;
  position: number;
}

export interface SectionDetailResponse extends SectionResponse {
  lessons: LessonResponse[];
}

export function toSectionResponse(section: Section): SectionResponse {
  return {
    id: section.id,
    courseId: section.courseId,
    title: section.title,
    position: section.position,
  };
}
