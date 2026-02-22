import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CapacityEngineService } from '../capacity-engine/capacity-engine.service';
import { AuditService } from '../audit/audit.service';
import { notFound, forbidden, validationError } from '../common/errors';
import {
  CreateDepartureDto,
  UpdateDepartureDto,
  CloseDepartureDto,
  DepartureQueryDto,
} from './departures.dto';
import { AuthUser } from '../common/decorators/current-user.decorator';
import { hasMinRole } from '../common/decorators/roles.decorator';
import { isSameDay } from '../common/date-utils';

@Injectable()
export class DeparturesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly capacity: CapacityEngineService,
    private readonly audit: AuditService,
  ) {}

  async list(agencyId: string, query: DepartureQueryDto) {
    const departures = await this.prisma.tourDeparture.findMany({
      where: {
        agencyId,
        startAt: {
          gte: new Date(query.from),
          lte: new Date(query.to),
        },
        ...(query.tour_id ? { tourId: query.tour_id } : {}),
      },
      orderBy: { startAt: 'asc' },
    });

    // Compute capacity for each departure
    return Promise.all(
      departures.map(async (d) => {
        const { capacityUsed, capacityRemaining, isOverbooked } =
          await this.capacity.getCapacitySummary(d.id, agencyId);
        return {
          id: d.id,
          tour_id: d.tourId,
          start_at: d.startAt,
          capacity_total: d.capacityTotal,
          capacity_used: capacityUsed,
          capacity_remaining: capacityRemaining,
          is_overbooked: isOverbooked,
          status: d.status,
          notes: d.notes,
        };
      }),
    );
  }

  async create(agencyId: string, dto: CreateDepartureDto, user: AuthUser) {
    const tour = await this.prisma.tour.findFirst({
      where: { id: dto.tour_id, agencyId },
    });
    if (!tour) throw notFound('Tour', dto.tour_id);

    const departure = await this.prisma.tourDeparture.create({
      data: {
        agencyId,
        tourId: dto.tour_id,
        startAt: new Date(dto.start_at),
        capacityTotal: dto.capacity_total,
        notes: dto.notes ?? null,
      },
    });

    await this.audit.log({
      agencyId,
      entityType: 'departure',
      entityId: departure.id,
      action: 'CREATE',
      changes: { after: { ...departure } },
      createdBy: user.id,
    });

    return { id: departure.id };
  }

  async update(
    agencyId: string,
    departureId: string,
    dto: UpdateDepartureDto,
    user: AuthUser,
  ) {
    const departure = await this.prisma.tourDeparture.findFirst({
      where: { id: departureId, agencyId },
    });
    if (!departure) throw notFound('Departure', departureId);

    const before = { ...departure };
    const updates: Record<string, unknown> = {};

    // ─── Date change handling ────────────────────────────────────────────────
    let dateDayChanged = false;
    if (dto.start_at !== undefined) {
      const newStartAt = new Date(dto.start_at);
      dateDayChanged = !isSameDay(departure.startAt, newStartAt);
      updates.startAt = newStartAt;
    }

    // ─── Capacity reduction handling ─────────────────────────────────────────
    if (dto.capacity_total !== undefined) {
      const newCapacity = dto.capacity_total;

      if (newCapacity < departure.capacityTotal) {
        const { capacityUsed } = await this.capacity.getCapacitySummary(
          departureId,
          agencyId,
        );

        if (newCapacity < capacityUsed) {
          // Requires OWNER or STAFF_PRICING with a reason
          if (!hasMinRole(user.role, 'STAFF_PRICING')) {
            throw forbidden(
              'Reducing capacity below used requires STAFF_PRICING or OWNER role.',
            );
          }
          if (!dto.capacity_change_reason) {
            throw validationError(
              'capacity_change_reason is required when reducing capacity below current usage.',
            );
          }
        }
      }

      updates.capacityTotal = newCapacity;
    }

    if (dto.notes !== undefined) updates.notes = dto.notes;
    if (dto.status !== undefined) updates.status = dto.status;

    await this.prisma.$transaction(async (tx) => {
      // Lock the departure row
      await tx.$queryRaw`SELECT id FROM tour_departures WHERE id = ${departureId}::uuid FOR UPDATE`;

      await tx.tourDeparture.update({
        where: { id: departureId },
        data: updates,
      });

      // If the calendar day changed, trigger recalculation for all linked reservations
      if (dateDayChanged) {
        const reservations = await tx.reservation.findMany({
          where: {
            departureId,
            status: { in: ['RESERVED', 'PARTIALLY_PAID', 'PAID', 'CONFIRMED'] },
          },
          select: { id: true },
        });

        // Wipe items + adjustments for each reservation — repricing will be
        // done by the reservations service on next load / explicit recalculate.
        // For the MVP we delete snapshots immediately so they are rebuilt on access.
        for (const r of reservations) {
          await tx.reservationItemAdjustment.deleteMany({
            where: { reservationItem: { reservationId: r.id } },
          });
          await tx.reservationItem.deleteMany({
            where: { reservationId: r.id },
          });
          await tx.reservation.update({
            where: { id: r.id },
            data: {
              totalSnapshot: 0,
              totalFinal: 0,
              balanceDue: 0,
            },
          });
        }
      }
    });

    await this.audit.log({
      agencyId,
      entityType: 'departure',
      entityId: departureId,
      action: dateDayChanged ? 'UPDATE_DATE_REPRICE' : 'UPDATE',
      changes: { before, after: updates },
      createdBy: user.id,
    });

    return { updated: true };
  }

  async close(
    agencyId: string,
    departureId: string,
    dto: CloseDepartureDto,
    user: AuthUser,
  ) {
    const departure = await this.prisma.tourDeparture.findFirst({
      where: { id: departureId, agencyId },
    });
    if (!departure) throw notFound('Departure', departureId);

    await this.prisma.tourDeparture.update({
      where: { id: departureId },
      data: { status: 'CLOSED' },
    });

    await this.audit.log({
      agencyId,
      entityType: 'departure',
      entityId: departureId,
      action: 'CLOSE',
      changes: { reason: dto.reason ?? null },
      createdBy: user.id,
    });

    return { closed: true };
  }
}
