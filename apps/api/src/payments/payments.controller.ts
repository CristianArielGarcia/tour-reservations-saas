import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { CurrentUser, AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { CreatePaymentDto, CreateRefundDto } from './payments.dto';

@Controller()
export class PaymentsController {
  constructor(private readonly payments: PaymentsService) {}

  // ─── Payments ─────────────────────────────────────────────────────────────────

  @Get('reservations/:reservationId/payments')
  @Roles('VIEWER')
  async listPayments(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
  ) {
    return { data: await this.payments.listPayments(user.agencyId, reservationId) };
  }

  @Post('reservations/:reservationId/payments')
  @Roles('STAFF')
  async createPayment(
    @CurrentUser() user: AuthUser,
    @Param('reservationId') reservationId: string,
    @Body() dto: CreatePaymentDto,
  ) {
    return {
      data: await this.payments.createPayment(user.agencyId, reservationId, dto, user),
    };
  }

  // ─── Refunds ──────────────────────────────────────────────────────────────────

  @Post('payments/:paymentId/refunds')
  @Roles('STAFF')
  async createRefund(
    @CurrentUser() user: AuthUser,
    @Param('paymentId') paymentId: string,
    @Body() dto: CreateRefundDto,
  ) {
    return {
      data: await this.payments.createRefund(user.agencyId, paymentId, dto, user),
    };
  }
}
