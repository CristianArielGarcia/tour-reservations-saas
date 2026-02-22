import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { capacityExceeded } from '../common/errors';

export interface CapacityResult {
  capacityTotal: number;
  capacityUsed: number;
  capacityRemaining: number;
  isOverbooked: boolean;
}

@Injectable()
export class CapacityEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Compute capacity_used for a departure.
   * Only counts passengers where occupies_capacity = true.
   * Statuses counted: RESERVED, PARTIALLY_PAID, PAID, CONFIRMED.
   * Optionally excludes a specific reservation (used when editing an existing one).
   *
   * Mirrors §14.1 of 02_data_model_schema.md exactly.
   */
  async computeCapacityUsed(
    departureId: string,
    agencyId: string,
    excludeReservationId?: string,
  ): Promise<number> {
    if (excludeReservationId) {
      const result = await this.prisma.$queryRaw<Array<{ capacity_used: bigint }>>`
        SELECT COALESCE(SUM(CASE WHEN pc.occupies_capacity THEN 1 ELSE 0 END), 0) AS capacity_used
        FROM reservations r
        JOIN reservation_passengers rp ON rp.reservation_id = r.id
        JOIN passenger_categories pc
          ON pc.agency_id = r.agency_id
         AND pc.code = rp.category_code
        WHERE r.departure_id = ${departureId}::uuid
          AND r.agency_id   = ${agencyId}::uuid
          AND r.id          != ${excludeReservationId}::uuid
          AND r.status IN ('RESERVED', 'PARTIALLY_PAID', 'PAID', 'CONFIRMED')
      `;
      return Number(result[0]?.capacity_used ?? 0);
    }

    const result = await this.prisma.$queryRaw<Array<{ capacity_used: bigint }>>`
      SELECT COALESCE(SUM(CASE WHEN pc.occupies_capacity THEN 1 ELSE 0 END), 0) AS capacity_used
      FROM reservations r
      JOIN reservation_passengers rp ON rp.reservation_id = r.id
      JOIN passenger_categories pc
        ON pc.agency_id = r.agency_id
       AND pc.code = rp.category_code
      WHERE r.departure_id = ${departureId}::uuid
        AND r.agency_id   = ${agencyId}::uuid
        AND r.status IN ('RESERVED', 'PARTIALLY_PAID', 'PAID', 'CONFIRMED')
    `;
    return Number(result[0]?.capacity_used ?? 0);
  }

  /**
   * Get full capacity summary for a departure (with derived fields).
   */
  async getCapacitySummary(
    departureId: string,
    agencyId: string,
    excludeReservationId?: string,
  ): Promise<CapacityResult> {
    const departure = await this.prisma.tourDeparture.findFirst({
      where: { id: departureId, agencyId },
    });

    if (!departure) {
      throw new Error(`Departure ${departureId} not found`);
    }

    const capacityUsed = await this.computeCapacityUsed(
      departureId,
      agencyId,
      excludeReservationId,
    );

    const capacityTotal = departure.capacityTotal;
    const capacityRemaining = Math.max(capacityTotal - capacityUsed, 0);
    const isOverbooked = capacityUsed > capacityTotal;

    return { capacityTotal, capacityUsed, capacityRemaining, isOverbooked };
  }

  /**
   * Validate that adding `requestedAdditional` passengers is allowed.
   * MUST be called inside a transaction AFTER locking the departure row FOR UPDATE.
   * If overbook is not enabled and capacity is exceeded → throws 409 capacity_exceeded.
   */
  async validateCapacity(
    departureId: string,
    agencyId: string,
    requestedAdditional: number,
    allowOverbook: boolean,
    excludeReservationId?: string,
  ): Promise<{ wasOverbook: boolean }> {
    const { capacityTotal, capacityUsed } = await this.getCapacitySummary(
      departureId,
      agencyId,
      excludeReservationId,
    );

    const wouldExceed = capacityUsed + requestedAdditional > capacityTotal;

    if (wouldExceed && !allowOverbook) {
      throw capacityExceeded(capacityTotal, capacityUsed, requestedAdditional);
    }

    return { wasOverbook: wouldExceed };
  }
}
