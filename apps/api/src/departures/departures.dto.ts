import {
  IsString,
  IsOptional,
  IsInt,
  IsEnum,
  IsDateString,
  IsUUID,
  Min,
  MinLength,
} from 'class-validator';
import { DepartureStatus } from '@prisma/client';

export class CreateDepartureDto {
  @IsUUID()
  tour_id!: string;

  @IsDateString()
  start_at!: string;

  @IsInt()
  @Min(0)
  capacity_total!: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateDepartureDto {
  @IsOptional()
  @IsDateString()
  start_at?: string;

  @IsOptional()
  @IsInt()
  @Min(0)
  capacity_total?: number;

  @IsOptional()
  @IsString()
  notes?: string;

  @IsOptional()
  @IsEnum(DepartureStatus)
  status?: DepartureStatus;

  @IsOptional()
  @IsString()
  capacity_change_reason?: string;
}

export class CloseDepartureDto {
  @IsOptional()
  @IsString()
  reason?: string;
}

export class DepartureQueryDto {
  @IsDateString()
  from!: string;

  @IsDateString()
  to!: string;

  @IsOptional()
  @IsUUID()
  tour_id?: string;
}
