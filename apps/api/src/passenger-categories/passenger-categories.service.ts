import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { notFound } from '../common/errors';
import {
  CreatePassengerCategoryDto,
  UpdatePassengerCategoryDto,
} from './passenger-categories.dto';

@Injectable()
export class PassengerCategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(agencyId: string) {
    return this.prisma.passengerCategory.findMany({
      where: { agencyId },
      orderBy: { code: 'asc' },
    });
  }

  async create(agencyId: string, dto: CreatePassengerCategoryDto) {
    const cat = await this.prisma.passengerCategory.create({
      data: {
        agencyId,
        code: dto.code,
        name: dto.name,
        minAgeYears: dto.min_age_years ?? null,
        maxAgeYears: dto.max_age_years ?? null,
        basePriceMultiplier: dto.base_price_multiplier,
        occupiesCapacity: dto.occupies_capacity ?? true,
      },
    });
    return { id: cat.id };
  }

  async update(agencyId: string, categoryId: string, dto: UpdatePassengerCategoryDto) {
    const existing = await this.prisma.passengerCategory.findFirst({
      where: { id: categoryId, agencyId },
    });
    if (!existing) throw notFound('PassengerCategory', categoryId);

    await this.prisma.passengerCategory.update({
      where: { id: categoryId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.base_price_multiplier !== undefined
          ? { basePriceMultiplier: dto.base_price_multiplier }
          : {}),
        ...(dto.occupies_capacity !== undefined
          ? { occupiesCapacity: dto.occupies_capacity }
          : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.min_age_years !== undefined ? { minAgeYears: dto.min_age_years } : {}),
        ...(dto.max_age_years !== undefined ? { maxAgeYears: dto.max_age_years } : {}),
      },
    });

    return { updated: true };
  }

  /** Used by pricing engine to get a category map for an agency */
  async getCategoryMap(agencyId: string): Promise<Map<string, { basePriceMultiplier: number; occupiesCapacity: boolean }>> {
    const cats = await this.prisma.passengerCategory.findMany({
      where: { agencyId, active: true },
    });
    const map = new Map<string, { basePriceMultiplier: number; occupiesCapacity: boolean }>();
    for (const c of cats) {
      map.set(c.code, {
        basePriceMultiplier: Number(c.basePriceMultiplier),
        occupiesCapacity: c.occupiesCapacity,
      });
    }
    return map;
  }
}
