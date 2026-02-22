import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { notFound, pricingOverlap, validationError } from '../common/errors';
import {
  CreatePriceBookDto,
  CreateTourItemPriceDto,
  ClosePriceDto,
  UpdatePriceDto,
  CreateCategoryRuleDto,
  UpdateCategoryRuleDto,
} from './pricing.dto';

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Price Books ────────────────────────────────────────────────────────────

  async listPriceBooks(agencyId: string) {
    return this.prisma.priceBook.findMany({
      where: { agencyId },
      orderBy: [{ currency: 'asc' }, { name: 'asc' }],
    });
  }

  async createPriceBook(agencyId: string, dto: CreatePriceBookDto) {
    const pb = await this.prisma.priceBook.create({
      data: {
        agencyId,
        currency: dto.currency,
        name: dto.name ?? 'default',
      },
    });
    return { id: pb.id };
  }

  // ─── Tour Item Prices ────────────────────────────────────────────────────────

  async listPrices(agencyId: string, itemId: string, priceBookId: string) {
    const item = await this.prisma.tourItem.findFirst({
      where: { id: itemId, agencyId },
    });
    if (!item) throw notFound('TourItem', itemId);

    return this.prisma.tourItemPrice.findMany({
      where: { tourItemId: itemId, priceBookId, agencyId },
      orderBy: { validFrom: 'desc' },
    });
  }

  async createPrice(agencyId: string, itemId: string, dto: CreateTourItemPriceDto) {
    const item = await this.prisma.tourItem.findFirst({
      where: { id: itemId, agencyId },
    });
    if (!item) throw notFound('TourItem', itemId);

    const priceBook = await this.prisma.priceBook.findFirst({
      where: { id: dto.price_book_id, agencyId },
    });
    if (!priceBook) throw notFound('PriceBook', dto.price_book_id);

    const validFrom = new Date(dto.valid_from);
    const validTo = dto.valid_to ? new Date(dto.valid_to) : null;

    if (validTo && validTo < validFrom) {
      throw validationError('valid_to must be >= valid_from');
    }

    try {
      const price = await this.prisma.tourItemPrice.create({
        data: {
          agencyId,
          tourItemId: itemId,
          priceBookId: dto.price_book_id,
          validFrom,
          validTo,
          unitPrice: dto.unit_price,
        },
      });
      return { id: price.id };
    } catch (err: unknown) {
      // Postgres EXCLUDE constraint violation
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as Record<string, unknown>).code === 'P2010'
      ) {
        throw pricingOverlap();
      }
      // Prisma unique/constraint error codes
      if (
        typeof err === 'object' &&
        err !== null &&
        'code' in err &&
        (err as Record<string, unknown>).code === 'P2002'
      ) {
        throw pricingOverlap();
      }
      // Raw Postgres error via Prisma
      if (
        typeof err === 'object' &&
        err !== null &&
        'message' in err &&
        typeof (err as Record<string, unknown>).message === 'string' &&
        ((err as Record<string, unknown>).message as string).includes('tour_item_prices_no_overlap')
      ) {
        throw pricingOverlap();
      }
      throw err;
    }
  }

  async closePrice(agencyId: string, priceId: string, dto: ClosePriceDto) {
    const price = await this.prisma.tourItemPrice.findFirst({
      where: { id: priceId, agencyId },
    });
    if (!price) throw notFound('TourItemPrice', priceId);

    const validTo = new Date(dto.valid_to);
    if (validTo < price.validFrom) {
      throw validationError('valid_to must be >= valid_from of this price');
    }

    await this.prisma.tourItemPrice.update({
      where: { id: priceId },
      data: { validTo },
    });

    return { closed: true };
  }

  async updatePrice(agencyId: string, priceId: string, dto: UpdatePriceDto) {
    const price = await this.prisma.tourItemPrice.findFirst({
      where: { id: priceId, agencyId },
    });
    if (!price) throw notFound('TourItemPrice', priceId);

    await this.prisma.tourItemPrice.update({
      where: { id: priceId },
      data: {
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });

    return { updated: true };
  }

  // ─── Category Rules ──────────────────────────────────────────────────────────

  async listCategoryRules(agencyId: string, itemId: string) {
    const item = await this.prisma.tourItem.findFirst({
      where: { id: itemId, agencyId },
    });
    if (!item) throw notFound('TourItem', itemId);

    return this.prisma.tourItemCategoryRule.findMany({
      where: { tourItemId: itemId, agencyId },
      include: { passengerCategory: true },
    });
  }

  async createCategoryRule(
    agencyId: string,
    itemId: string,
    dto: CreateCategoryRuleDto,
  ) {
    const item = await this.prisma.tourItem.findFirst({
      where: { id: itemId, agencyId },
    });
    if (!item) throw notFound('TourItem', itemId);

    const cat = await this.prisma.passengerCategory.findFirst({
      where: { id: dto.passenger_category_id, agencyId },
    });
    if (!cat) throw notFound('PassengerCategory', dto.passenger_category_id);

    const rule = await this.prisma.tourItemCategoryRule.create({
      data: {
        agencyId,
        tourItemId: itemId,
        passengerCategoryId: dto.passenger_category_id,
        multiplier: dto.multiplier,
      },
    });
    return { id: rule.id };
  }

  async updateCategoryRule(
    agencyId: string,
    ruleId: string,
    dto: UpdateCategoryRuleDto,
  ) {
    const rule = await this.prisma.tourItemCategoryRule.findFirst({
      where: { id: ruleId, agencyId },
    });
    if (!rule) throw notFound('TourItemCategoryRule', ruleId);

    await this.prisma.tourItemCategoryRule.update({
      where: { id: ruleId },
      data: {
        ...(dto.multiplier !== undefined ? { multiplier: dto.multiplier } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });

    return { updated: true };
  }
}
