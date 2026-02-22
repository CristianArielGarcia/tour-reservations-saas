import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { missingPrice } from '../common/errors';
import { toDateString } from '../common/date-utils';
import { ChargeType, TourItemKind } from '@prisma/client';
import Decimal from 'decimal.js';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PassengerInput {
  category_code: string;
}

export interface AddonInput {
  tour_item_code: string;
  quantity: number;
}

export interface SnapshotLineInput {
  agencyId: string;
  tourId: string;
  departureDate: Date;   // The DATE of the departure (used for price lookup)
  currency: string;      // 'USD' | 'ARS'
  passengers: PassengerInput[];
  selectedAddons: AddonInput[];
}

export interface SnapshotLine {
  tourItemId: string;
  nameSnapshot: string;
  kindSnapshot: TourItemKind;
  chargeTypeSnapshot: ChargeType;
  isOptionalSnapshot: boolean;
  quantity: number;
  unitPriceSnapshot: Decimal;
  totalPriceSnapshot: Decimal;
  pricingMeta: Record<string, unknown>;
}

export interface SnapshotResult {
  lines: SnapshotLine[];
  totalSnapshot: Decimal;
}

// ─── Service ─────────────────────────────────────────────────────────────────

@Injectable()
export class PricingEngineService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Build reservation_items snapshot for a new or recalculated reservation.
   *
   * Rules (from 06_business_rules_engine.md):
   *
   * BASE item (PER_PERSON):
   *   - For each passenger, look up category.base_price_multiplier
   *   - unit_price = base_unit_price × multiplier (per passenger)
   *   - total = sum over all passengers
   *
   * FEE / ADDON item (PER_PERSON):
   *   - category multipliers come from tour_item_category_rules (NOT base_price_multiplier)
   *   - If no rule for a category → multiplier = 1.0
   *   - unit_price = base_unit_price × override_multiplier (per passenger)
   *   - total = sum over all passengers
   *
   * PER_BOOKING items:
   *   - No per-passenger multipliers; quantity drives total
   *   - total = unit_price × quantity
   *
   * Missing price for ANY mandatory item → throw missingPrice (entire op fails)
   */
  async buildSnapshot(input: SnapshotLineInput): Promise<SnapshotResult> {
    const { agencyId, tourId, departureDate, currency, passengers, selectedAddons } = input;

    // 1. Resolve price book for this agency + currency
    const priceBook = await this.prisma.priceBook.findFirst({
      where: { agencyId, currency: currency as 'USD' | 'ARS', active: true },
    });
    if (!priceBook) throw missingPrice(`price book for currency ${currency}`);

    // 2. Load all tour items for this tour
    const tourItems = await this.prisma.tourItem.findMany({
      where: { tourId, agencyId, active: true },
    });

    // 3. Load passenger categories for this agency
    const categories = await this.prisma.passengerCategory.findMany({
      where: { agencyId, active: true },
    });
    const categoryMap = new Map(categories.map((c) => [c.code, c]));

    // 4. Load category override rules for all tour items in this tour
    const itemIds = tourItems.map((i) => i.id);
    const categoryRules = await this.prisma.tourItemCategoryRule.findMany({
      where: { tourItemId: { in: itemIds }, agencyId, active: true },
    });
    // Map: itemId → categoryCode → multiplier
    const ruleMap = new Map<string, Map<string, Decimal>>();
    for (const rule of categoryRules) {
      const cat = categories.find((c) => c.id === rule.passengerCategoryId);
      if (!cat) continue;
      if (!ruleMap.has(rule.tourItemId)) ruleMap.set(rule.tourItemId, new Map());
      ruleMap.get(rule.tourItemId)!.set(cat.code, new Decimal(rule.multiplier.toString()));
    }

    // 5. Load active prices for all items (for departure date)
    const departureDateStr = toDateString(departureDate);
    const pricesRaw = await this.prisma.$queryRaw<
      Array<{
        id: string;
        tour_item_id: string;
        price_book_id: string;
        unit_price: string;
        valid_from: Date;
        valid_to: Date | null;
      }>
    >`
      SELECT DISTINCT ON (tip.tour_item_id)
        tip.id,
        tip.tour_item_id,
        tip.price_book_id,
        tip.unit_price::text,
        tip.valid_from,
        tip.valid_to
      FROM tour_item_prices tip
      WHERE tip.tour_item_id = ANY(${itemIds}::uuid[])
        AND tip.price_book_id = ${priceBook.id}::uuid
        AND tip.active = true
        AND tip.valid_from <= ${departureDateStr}::date
        AND (tip.valid_to IS NULL OR tip.valid_to >= ${departureDateStr}::date)
      ORDER BY tip.tour_item_id, tip.valid_from DESC
    `;

    // Map: itemId → unit_price (Decimal)
    const priceMap = new Map<string, Decimal>();
    for (const p of pricesRaw) {
      priceMap.set(p.tour_item_id, new Decimal(p.unit_price));
    }

    // 6. Build addon lookup (code → tour item)
    const addonMap = new Map(tourItems.map((i) => [i.code, i]));

    // 7. Determine which items to price
    //    - All mandatory (non-optional) items
    //    - Selected addons (optional items explicitly chosen)
    const linesToPrice: Array<{ item: typeof tourItems[0]; quantity: number }> = [];

    for (const item of tourItems) {
      if (!item.isOptional) {
        linesToPrice.push({ item, quantity: item.defaultQuantity });
      }
    }

    for (const addon of selectedAddons) {
      const item = addonMap.get(addon.tour_item_code);
      if (!item) continue; // validation done in reservations service
      if (item.kind !== 'ADDON') continue;
      linesToPrice.push({ item, quantity: addon.quantity });
    }

    // 8. Compute snapshot lines
    const lines: SnapshotLine[] = [];
    let totalSnapshot = new Decimal(0);

    for (const { item, quantity } of linesToPrice) {
      const baseUnitPrice = priceMap.get(item.id);

      if (!baseUnitPrice && !item.isOptional) {
        throw missingPrice(item.code);
      }
      if (!baseUnitPrice) continue; // optional item with no price → skip silently

      let totalPriceForLine = new Decimal(0);
      const breakdown: Record<string, unknown>[] = [];

      if (item.chargeType === ChargeType.PER_PERSON) {
        for (const passenger of passengers) {
          const cat = categoryMap.get(passenger.category_code);
          if (!cat) continue;

          let multiplier: Decimal;

          if (item.kind === TourItemKind.BASE) {
            // BASE: use passenger_category.base_price_multiplier
            multiplier = new Decimal(cat.basePriceMultiplier.toString());
          } else {
            // FEE / ADDON: use tour_item_category_rules override or 1.0
            const override = ruleMap.get(item.id)?.get(passenger.category_code);
            multiplier = override ?? new Decimal('1.000');
          }

          const passengerPrice = baseUnitPrice.mul(multiplier).toDecimalPlaces(2);
          totalPriceForLine = totalPriceForLine.add(passengerPrice);

          breakdown.push({
            category_code: passenger.category_code,
            base_unit_price: baseUnitPrice.toString(),
            multiplier: multiplier.toString(),
            passenger_price: passengerPrice.toString(),
          });
        }
      } else {
        // PER_BOOKING: no passenger multipliers
        totalPriceForLine = baseUnitPrice.mul(quantity).toDecimalPlaces(2);
        breakdown.push({
          charge_type: 'PER_BOOKING',
          unit_price: baseUnitPrice.toString(),
          quantity,
          total: totalPriceForLine.toString(),
        });
      }

      totalSnapshot = totalSnapshot.add(totalPriceForLine);

      lines.push({
        tourItemId: item.id,
        nameSnapshot: item.name,
        kindSnapshot: item.kind,
        chargeTypeSnapshot: item.chargeType,
        isOptionalSnapshot: item.isOptional,
        quantity,
        unitPriceSnapshot: baseUnitPrice,
        totalPriceSnapshot: totalPriceForLine,
        pricingMeta: {
          currency,
          price_book_id: priceBook.id,
          departure_date: departureDateStr,
          breakdown,
        },
      });
    }

    return { lines, totalSnapshot };
  }

  /**
   * Recompute total_final from total_snapshot + adjustments.
   * Returns the new total_final (clamped to 0 from below by caller).
   */
  computeTotalFinal(
    totalSnapshot: Decimal,
    adjustments: Array<{
      type: string;
      amount: Decimal;
      itemTotalSnapshot: Decimal;
    }>,
  ): Decimal {
    let delta = new Decimal(0);

    for (const adj of adjustments) {
      switch (adj.type) {
        case 'DISCOUNT_AMOUNT':
          delta = delta.sub(adj.amount);
          break;
        case 'SURCHARGE_AMOUNT':
          delta = delta.add(adj.amount);
          break;
        case 'DISCOUNT_PERCENT':
          delta = delta.sub(
            adj.itemTotalSnapshot.mul(adj.amount).div(100).toDecimalPlaces(2),
          );
          break;
        case 'OVERRIDE_UNIT_PRICE':
          // amount is the new unit price; delta = (new_price × qty) - base_total
          // For MVP we store the delta directly as OVERRIDE_UNIT_PRICE amount = new unit_price
          // The impact is tracked in the adjustment record; actual override effect
          // is calculated as: amount (new total for item) - item.total_price_snapshot
          delta = delta.add(adj.amount.sub(adj.itemTotalSnapshot));
          break;
      }
    }

    return totalSnapshot.add(delta);
  }

  /**
   * Derive accounting totals from payments and refunds.
   */
  computeAccountingTotals(
    totalFinal: Decimal,
    payments: Array<{ amount: Decimal; status: string }>,
    refunds: Array<{ amount: Decimal }>,
  ): {
    totalPaid: Decimal;
    totalRefunded: Decimal;
    netPaid: Decimal;
    balanceDue: Decimal;
  } {
    const totalPaid = payments
      .filter((p) => p.status === 'RECEIVED')
      .reduce((sum, p) => sum.add(p.amount), new Decimal(0));

    const totalRefunded = refunds.reduce((sum, r) => sum.add(r.amount), new Decimal(0));

    const netPaid = totalPaid.sub(totalRefunded);
    const balanceDue = Decimal.max(totalFinal.sub(netPaid), new Decimal(0));

    return { totalPaid, totalRefunded, netPaid, balanceDue };
  }

  /**
   * Derive the reservation status based on accounting (does not modify CONFIRMED → PAID).
   * Returns the derived status; caller decides whether to apply it.
   */
  deriveStatus(
    currentStatus: string,
    netPaid: Decimal,
    totalFinal: Decimal,
  ): string {
    if (currentStatus === 'CANCELLED') return 'CANCELLED';

    if (netPaid.gte(totalFinal) && totalFinal.gt(0)) return 'PAID';
    if (netPaid.gt(0)) return 'PARTIALLY_PAID';
    return 'RESERVED';
  }
}
