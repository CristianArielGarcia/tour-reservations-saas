import {
  IsString,
  IsOptional,
  IsBoolean,
  IsNumber,
  IsInt,
  Min,
  Max,
  MinLength,
} from 'class-validator';

export class CreatePassengerCategoryDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  min_age_years?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  max_age_years?: number;

  @IsNumber()
  @Min(0)
  base_price_multiplier!: number;

  @IsOptional()
  @IsBoolean()
  occupies_capacity?: boolean;
}

export class UpdatePassengerCategoryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  base_price_multiplier?: number;

  @IsOptional()
  @IsBoolean()
  occupies_capacity?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(0)
  min_age_years?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  max_age_years?: number;
}
