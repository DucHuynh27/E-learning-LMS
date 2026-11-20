import { CourseStatus, Course } from '../course.entity.js';
import type { SectionDetailResponse } from '../../sections/dto/section.response.js';

export interface CourseResponse {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  priceCents: number;
  status: CourseStatus;
  thumbnailKey: string | null;
  instructorId: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CourseDetailResponse extends CourseResponse {
  sections: SectionDetailResponse[];
}

export function toCourseResponse(course: Course): CourseResponse {
  return {
    id: course.id,
    title: course.title,
    slug: course.slug,
    description: course.description ?? null,
    priceCents: course.priceCents,
    status: course.status,
    thumbnailKey: course.thumbnailKey ?? null,
    instructorId: course.instructorId,
    createdAt: course.createdAt,
    updatedAt: course.updatedAt,
  };
}
