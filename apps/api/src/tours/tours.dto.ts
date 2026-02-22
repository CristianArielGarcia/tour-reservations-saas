import {
  IsString,
  IsOptional,
  IsInt,
  IsBoolean,
  MinLength,
  Min,
} from 'class-validator';

export class CreateTourDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration_minutes?: number;
}

export class UpdateTourDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  duration_minutes?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
