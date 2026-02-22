import {
  IsString,
  IsOptional,
  IsEnum,
  IsBoolean,
  IsArray,
  IsInt,
  IsDateString,
  IsEmail,
  IsUUID,
  Min,
  MinLength,
  ValidateNested,
  ArrayMinSize,
} from 'class-validator';
import { Type } from 'class-transformer';
import { CurrencyCode, ReservationStatus } from '@prisma/client';

// ─── Sub-DTOs ─────────────────────────────────────────────────────────────────

export class CustomerDto {
  @IsString()
  @MinLength(1)
  full_name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  lodging_address?: string;
}

export class PassengerDto {
  @IsOptional()
  @IsUUID()
  id?: string; // present on update

  @IsString()
  @MinLength(1)
  first_name!: string;

  @IsString()
  @MinLength(1)
  last_name!: string;

  @IsOptional()
  @IsDateString()
  birth_date?: string;

  @IsString()
  @MinLength(1)
  document_id!: string;

  @IsString()
  @MinLength(1)
  category_code!: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  lodging_address?: string;
}

export class AddonSelectionDto {
  @IsString()
  @MinLength(1)
  tour_item_code!: string;

  @IsInt()
  @Min(1)
  quantity!: number;
}

export class CapacityOverrideDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  reason?: string;
}

// ─── Create Reservation ───────────────────────────────────────────────────────

export class CreateReservationDto {
  @IsUUID()
  departure_id!: string;

  @IsEnum(CurrencyCode)
  currency!: CurrencyCode;

  @ValidateNested()
  @Type(() => CustomerDto)
  customer!: CustomerDto;

  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers!: PassengerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonSelectionDto)
  selected_addons?: AddonSelectionDto[];

  @IsOptional()
  @ValidateNested()
  @Type(() => CapacityOverrideDto)
  capacity_override?: CapacityOverrideDto;

  @IsOptional()
  @IsString()
  notes?: string;
}

// ─── Update Reservation ───────────────────────────────────────────────────────

export class UpdateReservationDto {
  @IsOptional()
  @IsUUID()
  departure_id?: string;

  @IsOptional()
  @IsEnum(CurrencyCode)
  currency?: CurrencyCode;

  @IsOptional()
  @ValidateNested()
  @Type(() => CustomerDto)
  customer?: CustomerDto;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers?: PassengerDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddonSelectionDto)
  selected_addons?: AddonSelectionDto[];

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => CapacityOverrideDto)
  capacity_override?: CapacityOverrideDto;
}

// ─── Status Change ────────────────────────────────────────────────────────────

export class ChangeStatusDto {
  @IsEnum(ReservationStatus)
  status!: ReservationStatus;

  @IsOptional()
  @IsString()
  reason?: string;
}

// ─── Adjustments ─────────────────────────────────────────────────────────────

export class CreateAdjustmentDto {
  @IsUUID()
  reservation_item_id!: string;

  @IsEnum(['OVERRIDE_UNIT_PRICE', 'DISCOUNT_AMOUNT', 'DISCOUNT_PERCENT', 'SURCHARGE_AMOUNT'])
  type!: string;

  @IsInt()
  @Min(0)
  amount!: number;

  @IsString()
  @MinLength(1)
  reason!: string;
}

// ─── Query ────────────────────────────────────────────────────────────────────

export class ReservationQueryDto {
  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsUUID()
  tour_id?: string;

  @IsOptional()
  @IsUUID()
  departure_id?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page_size?: number;
}
