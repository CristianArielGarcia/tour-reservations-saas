import { Injectable } from '@nestjs/common';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import { AuditService } from '../audit/audit.service';
import {
  notFound,
  currencyMismatch,
  refundExceedsPayment,
} from '../common/errors';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { CreatePaymentDto, CreateRefundDto } from './payments.dto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngine: PricingEngineService,
    private readonly audit: AuditService,
  ) {}

  // ─── Payments ─────────────────────────────────────────────────────────────────

  async listPayments(agencyId: string, reservationId: string) {
    const res = await this.prisma.reservation.findFirst({
      where: { id: reservationId, agencyId },
    });
    if (!res) throw notFound('Reservation', reservationId);

    return this.prisma.payment.findMany({
      where: { reservationId },
      orderBy: { receivedAt: 'asc' },
      include: { refunds: true },
    });
  }

  async createPayment(
    agencyId: string,
    reservationId: string,
    dto: CreatePaymentDto,
    user: AuthUser,
  ) {
    const res = await this.prisma.reservation.findFirst({
      where: { id: reservationId, agencyId },
      include: {
        payments: { include: { refunds: true } },
      },
    });
    if (!res) throw notFound('Reservation', reservationId);

    // Currency must match reservation currency (MVP strict)
    if (dto.currency !== res.currency) throw currencyMismatch();

    const newPayment = {
      amount: new Decimal(dto.amount),
      status: 'RECEIVED',
    };

    const existingPayments = res.payments.map((p) => ({
      amount: new Decimal(p.amount.toString()),
      status: p.status as string,
    }));
    const existingRefunds = res.payments.flatMap((p) =>
      p.refunds.map((r) => ({ amount: new Decimal(r.amount.toString()) })),
    );

    const allPayments = [...existingPayments, newPayment];
    const totalFinal = new Decimal(res.totalFinal.toString());

    const { totalPaid, totalRefunded, netPaid, balanceDue } =
      this.pricingEngine.computeAccountingTotals(totalFinal, allPayments, existingRefunds);

    // Derive new status
    const newStatus = this.pricingEngine.deriveStatus(
      res.status as string,
      netPaid,
      totalFinal,
    );

    await this.prisma.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          reservationId,
          status: 'RECEIVED',
          amount: dto.amount,
          currency: dto.currency,
          method: dto.method,
          reference: dto.reference ?? null,
          receivedAt: dto.received_at ? new Date(dto.received_at) : new Date(),
          createdBy: user.id,
        },
      });

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          totalPaid: totalPaid.toDecimalPlaces(2).toNumber(),
          totalRefunded: totalRefunded.toDecimalPlaces(2).toNumber(),
          netPaid: netPaid.toDecimalPlaces(2).toNumber(),
          balanceDue: balanceDue.toDecimalPlaces(2).toNumber(),
          status: newStatus as 'RESERVED' | 'PARTIALLY_PAID' | 'PAID' | 'CONFIRMED' | 'CANCELLED',
        },
      });

      await this.audit.logTx(tx, {
        agencyId,
        entityType: 'payment',
        entityId: payment.id,
        action: 'CREATE',
        changes: {
          reservation_id: reservationId,
          amount: dto.amount,
          currency: dto.currency,
          method: dto.method,
          new_status: newStatus,
          net_paid: netPaid.toString(),
          balance_due: balanceDue.toString(),
        },
        createdBy: user.id,
      });

      return payment;
    });

    return {
      id: (
        await this.prisma.payment.findFirst({
          where: { reservationId, createdBy: user.id },
          orderBy: { createdAt: 'desc' },
        })
      )?.id,
    };
  }

  // ─── Refunds ──────────────────────────────────────────────────────────────────

  async createRefund(
    agencyId: string,
    paymentId: string,
    dto: CreateRefundDto,
    user: AuthUser,
  ) {
    const payment = await this.prisma.payment.findFirst({
      where: { id: paymentId },
      include: {
        reservation: {
          include: {
            payments: { include: { refunds: true } },
          },
        },
        refunds: true,
      },
    });
    if (!payment) throw notFound('Payment', paymentId);

    const res = payment.reservation;
    if (res.agencyId !== agencyId) throw notFound('Payment', paymentId);

    // Validate: total refunded for THIS payment must not exceed payment.amount
    const currentPaymentRefundedSum = payment.refunds.reduce(
      (sum, r) => sum.add(new Decimal(r.amount.toString())),
      new Decimal(0),
    );
    const newRefundAmount = new Decimal(dto.amount);
    const paymentAmount = new Decimal(payment.amount.toString());

    if (currentPaymentRefundedSum.add(newRefundAmount).gt(paymentAmount)) {
      throw refundExceedsPayment();
    }

    // Recompute all accounting after adding this refund
    const allPayments = res.payments.map((p) => ({
      amount: new Decimal(p.amount.toString()),
      status: p.status as string,
    }));

    const allRefunds = [
      ...res.payments.flatMap((p) =>
        p.refunds.map((r) => ({ amount: new Decimal(r.amount.toString()) })),
      ),
      { amount: newRefundAmount },
    ];

    const totalFinal = new Decimal(res.totalFinal.toString());
    const { totalPaid, totalRefunded, netPaid, balanceDue } =
      this.pricingEngine.computeAccountingTotals(totalFinal, allPayments, allRefunds);

    const newStatus = this.pricingEngine.deriveStatus(
      res.status as string,
      netPaid,
      totalFinal,
    );

    await this.prisma.$transaction(async (tx) => {
      const refund = await tx.paymentRefund.create({
        data: {
          paymentId,
          amount: dto.amount,
          reason: dto.reason,
          createdBy: user.id,
          ...(dto.created_at ? { createdAt: new Date(dto.created_at) } : {}),
        },
      });

      await tx.reservation.update({
        where: { id: res.id },
        data: {
          totalPaid: totalPaid.toDecimalPlaces(2).toNumber(),
          totalRefunded: totalRefunded.toDecimalPlaces(2).toNumber(),
          netPaid: netPaid.toDecimalPlaces(2).toNumber(),
          balanceDue: balanceDue.toDecimalPlaces(2).toNumber(),
          status: newStatus as 'RESERVED' | 'PARTIALLY_PAID' | 'PAID' | 'CONFIRMED' | 'CANCELLED',
        },
      });

      await this.audit.logTx(tx, {
        agencyId,
        entityType: 'payment_refund',
        entityId: refund.id,
        action: 'CREATE',
        changes: {
          payment_id: paymentId,
          reservation_id: res.id,
          amount: dto.amount,
          reason: dto.reason,
          new_net_paid: netPaid.toString(),
          new_balance_due: balanceDue.toString(),
        },
        createdBy: user.id,
      });
    });

    return {
      id: (
        await this.prisma.paymentRefund.findFirst({
          where: { paymentId, createdBy: user.id },
          orderBy: { createdAt: 'desc' },
        })
      )?.id,
    };
  }
}
