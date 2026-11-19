import { IsInt, Max, Min } from 'class-validator';

export class UpdateProgressDto {
  @IsInt()
  @Min(0)
  @Max(2147483647)
  watchedSec: number;
}
