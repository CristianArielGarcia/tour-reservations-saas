import {
  IsString,
  IsOptional,
  IsEnum,
  IsNumber,
  IsPositive,
  IsDateString,
  MinLength,
} from 'class-validator';
import { CurrencyCode, PaymentMethod } from '@prisma/client';

export class CreatePaymentDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsOptional()
  @IsDateString()
  received_at?: string;
}

export class CreateRefundDto {
  @IsNumber()
  @IsPositive()
  amount!: number;

  @IsString()
  @MinLength(1)
  reason!: string;

  @IsOptional()
  @IsDateString()
  created_at?: string;
}
