import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsOptional,
  IsUUID,
  ValidateNested,
} from 'class-validator';

export class SubmitAnswerDto {
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID()
  questionId: string;
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsOptional()
  @IsUUID()
  optionId?: string | null;
}

export class SubmitAttemptDto {
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique((answer: SubmitAnswerDto | null) => answer?.questionId)
  @ValidateNested({ each: true })
  @Type(() => SubmitAnswerDto)
  answers: SubmitAnswerDto[];
}
