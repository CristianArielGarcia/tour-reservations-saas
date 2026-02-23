import { Injectable } from '@nestjs/common';
import { Prisma, ReservationStatus } from '@prisma/client';
import Decimal from 'decimal.js';
import { PrismaService } from '../prisma/prisma.service';
import { PricingEngineService } from '../pricing-engine/pricing-engine.service';
import { CapacityEngineService } from '../capacity-engine/capacity-engine.service';
import { AuditService } from '../audit/audit.service';
import {
  notFound,
  forbidden,
  invalidTransition,
  invalidTotal,
  validationError,
} from '../common/errors';
import { hasMinRole } from '../common/decorators/roles.decorator';
import { AuthUser } from '../common/decorators/current-user.decorator';
import {
  CreateReservationDto,
  UpdateReservationDto,
  ChangeStatusDto,
  CreateAdjustmentDto,
} from './reservations.dto';
import { isSameDay } from '../common/date-utils';
import { inactiveCategory } from '../common/errors';

// Valid status transitions matrix
const TRANSITIONS: Record<string, ReservationStatus[]> = {
  DRAFT:          ['RESERVED', 'CANCELLED'],
  RESERVED:       ['PARTIALLY_PAID', 'PAID', 'CONFIRMED', 'CANCELLED'],
  PARTIALLY_PAID: ['PAID', 'CONFIRMED', 'CANCELLED'],
  PAID:           ['CONFIRMED', 'CANCELLED'],
  CONFIRMED:      ['CANCELLED'],
  CANCELLED:      ['RESERVED'],
};

@Injectable()
export class ReservationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricingEngine: PricingEngineService,
    private readonly capacityEngine: CapacityEngineService,
    private readonly audit: AuditService,
  ) {}

  // ─── List ────────────────────────────────────────────────────────────────────

  async list(agencyId: string, query: {
    from?: string; to?: string; status?: string;
    tour_id?: string; departure_id?: string;
    page: number; pageSize: number;
  }) {
    const where: Prisma.ReservationWhereInput = {
      agencyId,
      ...(query.status ? { status: query.status as ReservationStatus } : {}),
      ...(query.departure_id ? { departureId: query.departure_id } : {}),
      ...(query.tour_id
        ? { departure: { tourId: query.tour_id } }
        : {}),
      ...(query.from || query.to
        ? {
            departure: {
              startAt: {
                ...(query.from ? { gte: new Date(query.from) } : {}),
                ...(query.to ? { lte: new Date(query.to) } : {}),
              },
            },
          }
        : {}),
    };

    const [total, reservations] = await Promise.all([
      this.prisma.reservation.count({ where }),
      this.prisma.reservation.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: {
          id: true,
          departureId: true,
          status: true,
          currency: true,
          totalSnapshot: true,
          totalFinal: true,
          netPaid: true,
          balanceDue: true,
          createdAt: true,
        },
      }),
    ]);

    return { reservations, total };
  }

  // ─── Create ──────────────────────────────────────────────────────────────────

  async create(agencyId: string, dto: CreateReservationDto, user: AuthUser) {
    // Validate departure
    const departure = await this.prisma.tourDeparture.findFirst({
      where: { id: dto.departure_id, agencyId },
    });
    if (!departure) throw notFound('Departure', dto.departure_id);
    if (departure.status !== 'ACTIVE') {
      throw validationError('Departure is not ACTIVE and cannot accept new reservations.');
    }

    // Validate addon codes exist and are ADDON type for this tour
    for (const addon of dto.selected_addons ?? []) {
      const item = await this.prisma.tourItem.findFirst({
        where: { tourId: departure.tourId, agencyId, code: addon.tour_item_code, active: true },
      });
      if (!item) throw notFound('TourItem (addon)', addon.tour_item_code);
      if (item.kind !== 'ADDON') {
        throw validationError(`Tour item '${addon.tour_item_code}' is not an ADDON kind.`);
      }
    }

    // Validate category codes exist and are active for agency
    for (const p of dto.passengers) {
      const cat = await this.prisma.passengerCategory.findFirst({
        where: { agencyId, code: p.category_code },
      });
      if (!cat) throw notFound('PassengerCategory', p.category_code);
      if (!cat.active) throw inactiveCategory(p.category_code);
    }

    // Validate unique document_ids within the request
    const docIds = dto.passengers.map((p) => p.document_id);
    if (new Set(docIds).size !== docIds.length) {
      throw validationError('Duplicate document_id values in passengers list.');
    }

    const overrideEnabled = dto.capacity_override?.enabled ?? false;
    const overrideReason = dto.capacity_override?.reason;

    if (overrideEnabled) {
      if (!hasMinRole(user.role, 'STAFF_PRICING')) {
        throw forbidden('Capacity override requires STAFF_PRICING or OWNER role.');
      }
      if (!overrideReason) {
        throw validationError('capacity_override.reason is required when override is enabled.');
      }
    }

    // Count how many passengers occupy capacity
    const passengerCategories = await this.prisma.passengerCategory.findMany({
      where: { agencyId, active: true },
    });
    const catMap = new Map(passengerCategories.map((c) => [c.code, c]));
    const capacityRequested = dto.passengers.filter(
      (p) => catMap.get(p.category_code)?.occupiesCapacity ?? true,
    ).length;

    // Build pricing snapshot
    const snapshot = await this.pricingEngine.buildSnapshot({
      agencyId,
      tourId: departure.tourId,
      departureDate: departure.startAt,
      currency: dto.currency,
      passengers: dto.passengers,
      selectedAddons: dto.selected_addons ?? [],
    });

    // Run everything in a single transaction with capacity row lock
    const reservation = await this.prisma.$transaction(async (tx) => {
      // LOCK departure row to prevent race conditions
      await tx.$queryRaw`SELECT id FROM tour_departures WHERE id = ${dto.departure_id}::uuid FOR UPDATE`;

      // Validate capacity inside transaction
      const { wasOverbook } = await this.capacityEngine.validateCapacity(
        dto.departure_id,
        agencyId,
        capacityRequested,
        overrideEnabled,
      );

      // Create or find customer
      let customer = await tx.customer.findFirst({
        where: {
          agencyId,
          ...(dto.customer.email ? { email: dto.customer.email } : {}),
        },
      });

      if (!customer) {
        customer = await tx.customer.create({
          data: {
            agencyId,
            fullName: dto.customer.full_name,
            email: dto.customer.email ?? null,
            phone: dto.customer.phone ?? null,
            lodgingAddress: dto.customer.lodging_address ?? null,
          },
        });
      } else {
        await tx.customer.update({
          where: { id: customer.id },
          data: {
            fullName: dto.customer.full_name,
            phone: dto.customer.phone ?? null,
            lodgingAddress: dto.customer.lodging_address ?? null,
          },
        });
      }

      // Create reservation
      const res = await tx.reservation.create({
        data: {
          agencyId,
          departureId: dto.departure_id,
          customerId: customer.id,
          status: 'RESERVED',
          currency: dto.currency,
          totalSnapshot: snapshot.totalSnapshot.toDecimalPlaces(2).toNumber(),
          totalFinal: snapshot.totalSnapshot.toDecimalPlaces(2).toNumber(),
          totalPaid: 0,
          totalRefunded: 0,
          netPaid: 0,
          balanceDue: snapshot.totalSnapshot.toDecimalPlaces(2).toNumber(),
          notes: dto.notes ?? null,
          createdBy: user.id,
          ...(wasOverbook
            ? {
                capacityOverride: true,
                capacityOverrideReason: overrideReason,
                capacityOverrideBy: user.id,
                capacityOverrideAt: new Date(),
              }
            : {}),
        },
      });

      // Create passengers
      await tx.reservationPassenger.createMany({
        data: dto.passengers.map((p) => ({
          reservationId: res.id,
          firstName: p.first_name,
          lastName: p.last_name,
          birthDate: p.birth_date ? new Date(p.birth_date) : null,
          documentId: p.document_id,
          categoryCode: p.category_code,
          email: p.email ?? null,
          phone: p.phone ?? null,
          lodgingAddress: p.lodging_address ?? null,
        })),
      });

      // Create snapshot items
      await tx.reservationItem.createMany({
        data: snapshot.lines.map((line) => ({
          reservationId: res.id,
          tourItemId: line.tourItemId,
          nameSnapshot: line.nameSnapshot,
          kindSnapshot: line.kindSnapshot,
          chargeTypeSnapshot: line.chargeTypeSnapshot,
          isOptionalSnapshot: line.isOptionalSnapshot,
          quantity: line.quantity,
          unitPriceSnapshot: line.unitPriceSnapshot.toDecimalPlaces(2).toNumber(),
          totalPriceSnapshot: line.totalPriceSnapshot.toDecimalPlaces(2).toNumber(),
          pricingMeta: line.pricingMeta,
        })),
      });

      // Audit
      await this.audit.logTx(tx, {
        agencyId,
        entityType: 'reservation',
        entityId: res.id,
        action: 'CREATE',
        changes: {
          after: {
            status: 'RESERVED',
            currency: dto.currency,
            totalSnapshot: snapshot.totalSnapshot.toString(),
            totalFinal: snapshot.totalSnapshot.toString(),
            capacityOverride: wasOverbook,
          },
        },
        createdBy: user.id,
      });

      return res;
    });

    return {
      id: reservation.id,
      status: reservation.status,
      total_snapshot: Number(reservation.totalSnapshot),
      total_final: Number(reservation.totalFinal),
    };
  }

  // ─── Get Detail ──────────────────────────────────────────────────────────────

  async findOne(agencyId: string, reservationId: string) {
    const res = await this.prisma.reservation.findFirst({
      where: { id: reservationId, agencyId },
      include: {
        customer: true,
        passengers: true,
        items: {
          include: {
            adjustments: true,
          },
        },
        payments: {
          include: { refunds: true },
        },
      },
    });
    if (!res) throw notFound('Reservation', reservationId);

    const refunds = res.payments.flatMap((p) =>
      p.refunds.map((r) => ({ ...r, payment_id: p.id })),
    );

    return {
      id: res.id,
      status: res.status,
      currency: res.currency,
      customer: res.customer,
      passengers: res.passengers,
      items: res.items,
      adjustments: res.items.flatMap((i) => i.adjustments),
      payments: res.payments,
      refunds,
      totals: {
        total_snapshot: Number(res.totalSnapshot),
        total_final: Number(res.totalFinal),
        total_paid: Number(res.totalPaid),
        total_refunded: Number(res.totalRefunded),
        net_paid: Number(res.netPaid),
        balance_due: Number(res.balanceDue),
      },
    };
  }

  // ─── Update (may trigger recalculation) ───────────────────────────────────────

  async update(
    agencyId: string,
    reservationId: string,
    dto: UpdateReservationDto,
    user: AuthUser,
  ) {
    const res = await this.prisma.reservation.findFirst({
      where: { id: reservationId, agencyId },
      include: { passengers: true, departure: true },
    });
    if (!res) throw notFound('Reservation', reservationId);

    if (res.status === 'CANCELLED') {
      throw validationError('Cannot update a CANCELLED reservation. Reopen it first.');
    }

    // Determine if structural change → recalculation needed
    let needsRecalculation = false;

    const newDepartureId = dto.departure_id ?? res.departureId;
    const newCurrency = dto.currency ?? res.currency;

    let newDeparture = res.departure;
    if (dto.departure_id && dto.departure_id !== res.departureId) {
      const dep = await this.prisma.tourDeparture.findFirst({
        where: { id: dto.departure_id, agencyId },
      });
      if (!dep) throw notFound('Departure', dto.departure_id);
      if (dep.status !== 'ACTIVE') {
        throw validationError('Target departure is not ACTIVE.');
      }
      newDeparture = dep;
      needsRecalculation = true;
    }

    if (dto.currency && dto.currency !== res.currency) needsRecalculation = true;
    if (!isSameDay(res.departure.startAt, newDeparture.startAt)) needsRecalculation = true;
    if (dto.passengers !== undefined) needsRecalculation = true;
    if (dto.selected_addons !== undefined) needsRecalculation = true;

    const passengers = dto.passengers ?? res.passengers.map((p) => ({
      first_name: p.firstName,
      last_name: p.lastName,
      birth_date: p.birthDate?.toISOString(),
      document_id: p.documentId,
      category_code: p.categoryCode,
      email: p.email ?? undefined,
      phone: p.phone ?? undefined,
      lodging_address: p.lodgingAddress ?? undefined,
    }));

    // Capacity validation for structural changes
    const overrideEnabled = dto.capacity_override?.enabled ?? false;
    const overrideReason = dto.capacity_override?.reason;

    if (overrideEnabled && !hasMinRole(user.role, 'STAFF_PRICING')) {
      throw forbidden('Capacity override requires STAFF_PRICING or OWNER role.');
    }

    let snapshot: Awaited<ReturnType<PricingEngineService['buildSnapshot']>> | null = null;

    if (needsRecalculation) {
      // Validate categories exist and are active
      for (const p of passengers) {
        const cat = await this.prisma.passengerCategory.findFirst({
          where: { agencyId, code: p.category_code },
        });
        if (!cat) throw notFound('PassengerCategory', p.category_code);
        if (!cat.active) throw inactiveCategory(p.category_code);
      }

      // Build new snapshot
      snapshot = await this.pricingEngine.buildSnapshot({
        agencyId,
        tourId: newDeparture.tourId,
        departureDate: newDeparture.startAt,
        currency: newCurrency,
        passengers,
        selectedAddons: dto.selected_addons ?? [],
      });
    }

    // Capacity counting
    const passengerCategories = await this.prisma.passengerCategory.findMany({
      where: { agencyId, active: true },
    });
    const catMap = new Map(passengerCategories.map((c) => [c.code, c]));
    const capacityRequested = passengers.filter(
      (p) => catMap.get(p.category_code)?.occupiesCapacity ?? true,
    ).length;

    await this.prisma.$transaction(async (tx) => {
      // Lock departure row
      await tx.$queryRaw`SELECT id FROM tour_departures WHERE id = ${newDepartureId}::uuid FOR UPDATE`;

      if (needsRecalculation) {
        // Validate capacity (excluding current reservation from used count)
        await this.capacityEngine.validateCapacity(
          newDepartureId,
          agencyId,
          capacityRequested,
          overrideEnabled,
          reservationId,
        );

        // Delete existing items and adjustments (MVP strict: adjustments wiped on recalc)
        await tx.reservationItemAdjustment.deleteMany({
          where: { reservationItem: { reservationId } },
        });
        await tx.reservationItem.deleteMany({ where: { reservationId } });

        // Replace passengers if changed
        if (dto.passengers !== undefined) {
          await tx.reservationPassenger.deleteMany({ where: { reservationId } });
          await tx.reservationPassenger.createMany({
            data: passengers.map((p) => ({
              reservationId,
              firstName: p.first_name,
              lastName: p.last_name,
              birthDate: p.birth_date ? new Date(p.birth_date) : null,
              documentId: p.document_id,
              categoryCode: p.category_code,
              email: p.email ?? null,
              phone: p.phone ?? null,
              lodgingAddress: p.lodging_address ?? null,
            })),
          });
        }

        // Recreate snapshot items
        if (snapshot) {
          await tx.reservationItem.createMany({
            data: snapshot.lines.map((line) => ({
              reservationId,
              tourItemId: line.tourItemId,
              nameSnapshot: line.nameSnapshot,
              kindSnapshot: line.kindSnapshot,
              chargeTypeSnapshot: line.chargeTypeSnapshot,
              isOptionalSnapshot: line.isOptionalSnapshot,
              quantity: line.quantity,
              unitPriceSnapshot: line.unitPriceSnapshot.toDecimalPlaces(2).toNumber(),
              totalPriceSnapshot: line.totalPriceSnapshot.toDecimalPlaces(2).toNumber(),
              pricingMeta: line.pricingMeta,
            })),
          });

          const newTotal = snapshot.totalSnapshot.toDecimalPlaces(2).toNumber();
          const currentNetPaid = Number(res.netPaid);
          const newBalanceDue = Math.max(newTotal - currentNetPaid, 0);

          await tx.reservation.update({
            where: { id: reservationId },
            data: {
              departureId: newDepartureId,
              currency: newCurrency,
              totalSnapshot: newTotal,
              totalFinal: newTotal,
              balanceDue: newBalanceDue,
              ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
            },
          });
        }

        await this.audit.logTx(tx, {
          agencyId,
          entityType: 'reservation',
          entityId: reservationId,
          action: 'RECALCULATE',
          changes: {
            trigger: 'structural_change',
            before: {
              totalSnapshot: res.totalSnapshot,
              totalFinal: res.totalFinal,
              currency: res.currency,
              departureId: res.departureId,
            },
            after: {
              totalSnapshot: snapshot?.totalSnapshot.toString(),
              totalFinal: snapshot?.totalSnapshot.toString(),
              currency: newCurrency,
              departureId: newDepartureId,
            },
          },
          createdBy: user.id,
        });
      } else {
        // Non-structural update: only update notes / customer info
        const updates: Prisma.ReservationUpdateInput = {};
        if (dto.notes !== undefined) updates.notes = dto.notes;

        if (Object.keys(updates).length > 0) {
          await tx.reservation.update({ where: { id: reservationId }, data: updates });
        }

        // Update customer fields if provided
        if (dto.customer) {
          await tx.customer.update({
            where: { id: res.customerId },
            data: {
              fullName: dto.customer.full_name,
              email: dto.customer.email ?? null,
              phone: dto.customer.phone ?? null,
              lodgingAddress: dto.customer.lodging_address ?? null,
            },
          });
        }

        await this.audit.logTx(tx, {
          agencyId,
          entityType: 'reservation',
          entityId: reservationId,
          action: 'UPDATE',
          changes: { fields: Object.keys(dto) },
          createdBy: user.id,
        });
      }
    });

    return { updated: true };
  }

  // ─── Status Change ────────────────────────────────────────────────────────────

  async changeStatus(
    agencyId: string,
    reservationId: string,
    dto: ChangeStatusDto,
    user: AuthUser,
  ) {
    const res = await this.prisma.reservation.findFirst({
      where: { id: reservationId, agencyId },
    });
    if (!res) throw notFound('Reservation', reservationId);

    const from = res.status as string;
    const to = dto.status as string;

    // Validate transition is allowed
    const allowed = TRANSITIONS[from] ?? [];
    if (!allowed.includes(to as ReservationStatus)) {
      throw invalidTransition(from, to);
    }

    // Cancelling PAID/CONFIRMED requires OWNER
    if ((from === 'PAID' || from === 'CONFIRMED') && to === 'CANCELLED') {
      if (!hasMinRole(user.role, 'OWNER')) {
        throw forbidden('Cancelling a PAID or CONFIRMED reservation requires OWNER role.');
      }
    }

    // Reopening CANCELLED requires OWNER
    if (from === 'CANCELLED' && to === 'RESERVED') {
      if (!hasMinRole(user.role, 'OWNER')) {
        throw forbidden('Reopening a CANCELLED reservation requires OWNER role.');
      }
    }

    // CANCELLED requires reason
    if (to === 'CANCELLED' && !dto.reason) {
      throw validationError('reason is required when cancelling a reservation.');
    }

    // If reopening from CANCELLED → re-validate capacity
    if (from === 'CANCELLED' && to === 'RESERVED') {
      const passengers = await this.prisma.reservationPassenger.findMany({
        where: { reservationId },
      });
      const cats = await this.prisma.passengerCategory.findMany({
        where: { agencyId, active: true },
      });
      const catMap = new Map(cats.map((c) => [c.code, c]));
      const capacityNeeded = passengers.filter(
        (p) => catMap.get(p.categoryCode)?.occupiesCapacity ?? true,
      ).length;

      await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM tour_departures WHERE id = ${res.departureId}::uuid FOR UPDATE`;

        await this.capacityEngine.validateCapacity(
          res.departureId,
          agencyId,
          capacityNeeded,
          false, // no override on reopen without privilege
        );

        await tx.reservation.update({
          where: { id: reservationId },
          data: { status: 'RESERVED' },
        });

        await this.audit.logTx(tx, {
          agencyId,
          entityType: 'reservation',
          entityId: reservationId,
          action: 'STATUS_CHANGE',
          changes: { from, to, reason: dto.reason ?? null },
          createdBy: user.id,
        });
      });
    } else {
      await this.prisma.$transaction(async (tx) => {
        await tx.reservation.update({
          where: { id: reservationId },
          data: { status: dto.status },
        });

        await this.audit.logTx(tx, {
          agencyId,
          entityType: 'reservation',
          entityId: reservationId,
          action: 'STATUS_CHANGE',
          changes: { from, to, reason: dto.reason ?? null },
          createdBy: user.id,
        });
      });
    }

    return { status: dto.status };
  }

  // ─── Adjustments ─────────────────────────────────────────────────────────────

  async createAdjustment(
    agencyId: string,
    reservationId: string,
    dto: CreateAdjustmentDto,
    user: AuthUser,
  ) {
    const res = await this.prisma.reservation.findFirst({
      where: { id: reservationId, agencyId },
      include: {
        items: {
          include: { adjustments: true },
        },
        payments: { include: { refunds: true } },
      },
    });
    if (!res) throw notFound('Reservation', reservationId);

    const item = res.items.find((i) => i.id === dto.reservation_item_id);
    if (!item) throw notFound('ReservationItem', dto.reservation_item_id);

    if (dto.type === 'DISCOUNT_PERCENT' && dto.amount > 100) {
      throw validationError('DISCOUNT_PERCENT amount must be <= 100.');
    }

    // Compute what the new total_final would be
    const allAdjustments = res.items.flatMap((i) =>
      i.adjustments.map((a) => ({
        type: a.type as string,
        amount: new Decimal(a.amount.toString()),
        itemTotalSnapshot: new Decimal(i.totalPriceSnapshot.toString()),
      })),
    );

    // Add the new adjustment
    allAdjustments.push({
      type: dto.type,
      amount: new Decimal(dto.amount),
      itemTotalSnapshot: new Decimal(item.totalPriceSnapshot.toString()),
    });

    const newTotalFinal = this.pricingEngine.computeTotalFinal(
      new Decimal(res.totalSnapshot.toString()),
      allAdjustments,
    );

    if (newTotalFinal.lt(0)) throw invalidTotal();

    // Recompute accounting with new total_final
    const payments = res.payments.map((p) => ({
      amount: new Decimal(p.amount.toString()),
      status: p.status as string,
    }));
    const refunds = res.payments.flatMap((p) =>
      p.refunds.map((r) => ({ amount: new Decimal(r.amount.toString()) })),
    );

    const { totalPaid, totalRefunded, netPaid, balanceDue } =
      this.pricingEngine.computeAccountingTotals(newTotalFinal, payments, refunds);

    await this.prisma.$transaction(async (tx) => {
      const adj = await tx.reservationItemAdjustment.create({
        data: {
          reservationItemId: dto.reservation_item_id,
          type: dto.type as 'OVERRIDE_UNIT_PRICE' | 'DISCOUNT_AMOUNT' | 'DISCOUNT_PERCENT' | 'SURCHARGE_AMOUNT',
          amount: dto.amount,
          reason: dto.reason,
          createdBy: user.id,
        },
      });

      await tx.reservation.update({
        where: { id: reservationId },
        data: {
          totalFinal: newTotalFinal.toDecimalPlaces(2).toNumber(),
          totalPaid: totalPaid.toDecimalPlaces(2).toNumber(),
          totalRefunded: totalRefunded.toDecimalPlaces(2).toNumber(),
          netPaid: netPaid.toDecimalPlaces(2).toNumber(),
          balanceDue: balanceDue.toDecimalPlaces(2).toNumber(),
        },
      });

      await this.audit.logTx(tx, {
        agencyId,
        entityType: 'reservation',
        entityId: reservationId,
        action: 'ADJUSTMENT_ADDED',
        changes: {
          adjustment_id: adj.id,
          type: dto.type,
          amount: dto.amount,
          reason: dto.reason,
          new_total_final: newTotalFinal.toString(),
        },
        createdBy: user.id,
      });
    });

    return { id: (await this.prisma.reservationItemAdjustment.findFirst({
      where: { reservationItemId: dto.reservation_item_id },
      orderBy: { createdAt: 'desc' },
    }))?.id };
  }

  async deleteAdjustment(
    agencyId: string,
    adjustmentId: string,
    user: AuthUser,
  ) {
    const adj = await this.prisma.reservationItemAdjustment.findFirst({
      where: { id: adjustmentId },
      include: {
        reservationItem: {
          include: {
            reservation: {
              include: {
                items: { include: { adjustments: true } },
                payments: { include: { refunds: true } },
              },
            },
          },
        },
      },
    });
    if (!adj) throw notFound('Adjustment', adjustmentId);

    const res = adj.reservationItem.reservation;
    if (res.agencyId !== agencyId) throw forbidden();

    // Compute new total_final after removing this adjustment
    const remainingAdj = res.items.flatMap((i) =>
      i.adjustments
        .filter((a) => a.id !== adjustmentId)
        .map((a) => ({
          type: a.type as string,
          amount: new Decimal(a.amount.toString()),
          itemTotalSnapshot: new Decimal(i.totalPriceSnapshot.toString()),
        })),
    );

    const newTotalFinal = this.pricingEngine.computeTotalFinal(
      new Decimal(res.totalSnapshot.toString()),
      remainingAdj,
    );

    const payments = res.payments.map((p) => ({
      amount: new Decimal(p.amount.toString()),
      status: p.status as string,
    }));
    const refunds = res.payments.flatMap((p) =>
      p.refunds.map((r) => ({ amount: new Decimal(r.amount.toString()) })),
    );

    const { totalPaid, totalRefunded, netPaid, balanceDue } =
      this.pricingEngine.computeAccountingTotals(newTotalFinal, payments, refunds);

    await this.prisma.$transaction(async (tx) => {
      await tx.reservationItemAdjustment.delete({ where: { id: adjustmentId } });

      await tx.reservation.update({
        where: { id: res.id },
        data: {
          totalFinal: newTotalFinal.toDecimalPlaces(2).toNumber(),
          totalPaid: totalPaid.toDecimalPlaces(2).toNumber(),
          totalRefunded: totalRefunded.toDecimalPlaces(2).toNumber(),
          netPaid: netPaid.toDecimalPlaces(2).toNumber(),
          balanceDue: balanceDue.toDecimalPlaces(2).toNumber(),
        },
      });

      await this.audit.logTx(tx, {
        agencyId,
        entityType: 'reservation',
        entityId: res.id,
        action: 'ADJUSTMENT_DELETED',
        changes: {
          adjustment_id: adjustmentId,
          new_total_final: newTotalFinal.toString(),
        },
        createdBy: user.id,
      });
    });

    return { deleted: true };
  }
}
