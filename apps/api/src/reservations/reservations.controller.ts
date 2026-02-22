import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ReservationsService } from './reservations.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  CreateReservationDto,
  UpdateReservationDto,
  ChangeStatusDto,
  CreateAdjustmentDto,
  ReservationQueryDto,
} from './reservations.dto';
import { Type } from 'class-transformer';

@Controller()
export class ReservationsController {
  constructor(private readonly reservations: ReservationsService) {}

  // ─── Reservations ────────────────────────────────────────────────────────────

  @Get('reservations')
  @Roles('VIEWER')
  async list(@CurrentUser() user: AuthUser, @Query() query: ReservationQueryDto) {
    const page = query.page ?? 1;
    const pageSize = Math.min(query.page_size ?? 50, 200);

    const result = await this.reservations.list(user.agencyId, {
      from: query.from,
      to: query.to,
      status: query.status,
      tour_id: query.tour_id,
      departure_id: query.departure_id,
      page,
      pageSize,
    });

    return {
      data: result.reservations,
      meta: { page, page_size: pageSize, total: result.total },
    };
  }

  @Post('reservations')
  @Roles('STAFF')
  async create(@CurrentUser() user: AuthUser, @Body() dto: CreateReservationDto) {
    return { data: await this.reservations.create(user.agencyId, dto, user) };
  }

  @Get('reservations/:reservationId')
  @Roles('VIEWER')
  async findOne(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    return { data: await this.reservations.findOne(user.agencyId, reservationId) };
  }

  @Patch('reservations/:reservationId')
  @Roles('STAFF')
  async update(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @Body() dto: UpdateReservationDto,
  ) {
    return {
      data: await this.reservations.update(user.agencyId, reservationId, dto, user),
    };
  }

  @Post('reservations/:reservationId/status')
  @Roles('STAFF')
  async changeStatus(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @Body() dto: ChangeStatusDto,
  ) {
    return {
      data: await this.reservations.changeStatus(user.agencyId, reservationId, dto, user),
    };
  }

  // ─── Adjustments ─────────────────────────────────────────────────────────────

  @Post('reservations/:reservationId/adjustments')
  @Roles('STAFF_PRICING')
  async createAdjustment(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @Body() dto: CreateAdjustmentDto,
  ) {
    return {
      data: await this.reservations.createAdjustment(user.agencyId, reservationId, dto, user),
    };
  }

  @Delete('adjustments/:adjustmentId')
  @Roles('STAFF_PRICING')
  async deleteAdjustment(
    @CurrentUser() user: AuthUser,
    @Param('adjustmentId') adjustmentId: string,
  ) {
    return {
      data: await this.reservations.deleteAdjustment(user.agencyId, adjustmentId, user),
    };
  }
}
