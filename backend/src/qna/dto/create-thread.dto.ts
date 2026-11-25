import { IsOptional, IsString, IsUUID, Length } from 'class-validator';

export class CreateThreadDto {
  @IsString()
  @Length(1, 200)
  title: string;

  @IsOptional()
  @IsUUID()
  lessonId?: string;
}
