import { Course } from './course.entity.js';
import { Section } from '../sections/section.entity.js';
import { Lesson } from '../lessons/lesson.entity.js';
import { Enrolment } from '../enrolments/enrolment.entity.js';

export { Course, Section, Lesson, Enrolment };
export const CONTENT_ENTITIES = [Course, Section, Lesson, Enrolment];
