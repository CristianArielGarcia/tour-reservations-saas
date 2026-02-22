import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsBoolean,
  IsDateString,
  IsUUID,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { CurrencyCode } from '@prisma/client';

export class CreatePriceBookDto {
  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}

export class CreateTourItemPriceDto {
  @IsUUID()
  price_book_id!: string;

  @IsDateString()
  valid_from!: string;

  @IsOptional()
  @IsDateString()
  valid_to?: string;

  @IsNumber()
  @Min(0)
  unit_price!: number;
}

export class ClosePriceDto {
  @IsDateString()
  valid_to!: string;
}

export class UpdatePriceDto {
  @IsOptional()
  @IsBoolean()
  active?: boolean;
}

export class CreateCategoryRuleDto {
  @IsUUID()
  passenger_category_id!: string;

  @IsNumber()
  @Min(0)
  multiplier!: number;
}

export class UpdateCategoryRuleDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  multiplier?: number;

  @IsOptional()
  @IsBoolean()
  active?: boolean;
}
