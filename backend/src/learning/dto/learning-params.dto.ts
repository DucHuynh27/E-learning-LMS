import { IsString, IsUUID, Matches, MaxLength } from 'class-validator';

export class LessonParamsDto {
  @IsUUID() lessonId: string;
}

export class CourseParamsDto {
  @IsUUID() courseId: string;
}

export class AttemptParamsDto {
  @IsUUID() id: string;
}

export class CertificateParamsDto {
  @IsString()
  @MaxLength(64)
  @Matches(/^[A-Za-z0-9-]+$/)
  serialNo: string;
}
