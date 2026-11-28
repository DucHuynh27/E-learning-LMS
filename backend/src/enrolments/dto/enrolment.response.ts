import { Enrolment, EnrolmentStatus } from '../enrolment.entity.js';
import { CourseStatus } from '../../courses/course.entity.js';

export interface EnrolmentResponse {
  id: string;
  courseId: string;
  userId: string;
  status: EnrolmentStatus;
  progressPct: number;
  enrolledAt: Date;
  completedAt: Date | null;
  course: { title: string; status: CourseStatus } | null;
}

export function toEnrolmentResponse(enrolment: Enrolment): EnrolmentResponse {
  return {
    id: enrolment.id,
    courseId: enrolment.courseId,
    userId: enrolment.userId,
    status: enrolment.status,
    progressPct: enrolment.progressPct,
    enrolledAt: enrolment.enrolledAt,
    completedAt: enrolment.completedAt ?? null,
    course: enrolment.course
      ? {
          title: enrolment.course.title,
          status: enrolment.course.status,
        }
      : null,
  };
}
