import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsInt,
  MinLength,
  Min,
} from 'class-validator';
import { TourItemKind, ChargeType } from '@prisma/client';

export class CreateTourItemDto {
  @IsString()
  @MinLength(1)
  code!: string;

  @IsString()
  @MinLength(1)
  name!: string;

  @IsEnum(TourItemKind)
  kind!: TourItemKind;

  @IsEnum(ChargeType)
  charge_type!: ChargeType;

  @IsOptional()
  @IsBoolean()
  is_optional?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  default_quantity?: number;
}

export class UpdateTourItemDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsBoolean()
  is_optional?: boolean;

  @IsOptional()
  @IsBoolean()
  active?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  default_quantity?: number;
}
