import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { notFound } from '../common/errors';
import { CreateTourItemDto, UpdateTourItemDto } from './tour-items.dto';

@Injectable()
export class TourItemsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(agencyId: string, tourId: string) {
    // Verify tour belongs to agency
    const tour = await this.prisma.tour.findFirst({ where: { id: tourId, agencyId } });
    if (!tour) throw notFound('Tour', tourId);

    return this.prisma.tourItem.findMany({
      where: { tourId, agencyId },
      orderBy: { code: 'asc' },
    });
  }

  async create(agencyId: string, tourId: string, dto: CreateTourItemDto) {
    const tour = await this.prisma.tour.findFirst({ where: { id: tourId, agencyId } });
    if (!tour) throw notFound('Tour', tourId);

    const item = await this.prisma.tourItem.create({
      data: {
        agencyId,
        tourId,
        code: dto.code,
        name: dto.name,
        kind: dto.kind,
        chargeType: dto.charge_type,
        isOptional: dto.is_optional ?? false,
        defaultQuantity: dto.default_quantity ?? 1,
      },
    });
    return { id: item.id };
  }

  async findOne(agencyId: string, itemId: string) {
    const item = await this.prisma.tourItem.findFirst({
      where: { id: itemId, agencyId },
    });
    if (!item) throw notFound('TourItem', itemId);
    return item;
  }

  async update(agencyId: string, itemId: string, dto: UpdateTourItemDto) {
    const item = await this.prisma.tourItem.findFirst({ where: { id: itemId, agencyId } });
    if (!item) throw notFound('TourItem', itemId);

    await this.prisma.tourItem.update({
      where: { id: itemId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.is_optional !== undefined ? { isOptional: dto.is_optional } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
        ...(dto.default_quantity !== undefined ? { defaultQuantity: dto.default_quantity } : {}),
      },
    });

    return { updated: true };
  }
}
