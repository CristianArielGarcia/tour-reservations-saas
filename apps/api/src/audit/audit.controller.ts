import { Controller, Get, Query } from '@nestjs/common';
import { AuditService } from './audit.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { IsOptional, IsString, IsInt, Min, IsUUID, IsDateString } from 'class-validator';
import { Type } from 'class-transformer';

class AuditQueryDto {
  @IsOptional()
  @IsString()
  entity_type?: string;

  @IsOptional()
  @IsUUID()
  entity_id?: string;

  @IsOptional()
  @IsDateString()
  from?: string;

  @IsOptional()
  @IsDateString()
  to?: string;

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

@Controller('audit')
export class AuditController {
  constructor(private readonly audit: AuditService) {}

  @Get()
  @Roles('STAFF_PRICING')
  async list(@CurrentUser() user: AuthUser, @Query() query: AuditQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.page_size ?? 50, 200);

    const result = await this.audit.list(
      user.agencyId,
      query.entity_type,
      query.entity_id,
      query.from,
      query.to,
      page,
      pageSize,
    );

    return {
      data: result.entries,
      meta: {
        page: result.page,
        page_size: result.pageSize,
        total: result.total,
      },
    };
  }
}
