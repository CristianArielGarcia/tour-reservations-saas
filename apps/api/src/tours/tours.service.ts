import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { notFound } from '../common/errors';
import { CreateTourDto, UpdateTourDto } from './tours.dto';

@Injectable()
export class ToursService {
  constructor(private readonly prisma: PrismaService) {}

  async list(agencyId: string, active?: boolean) {
    return this.prisma.tour.findMany({
      where: {
        agencyId,
        ...(active !== undefined ? { active } : {}),
      },
      orderBy: { name: 'asc' },
    });
  }

  async create(agencyId: string, dto: CreateTourDto) {
    const tour = await this.prisma.tour.create({
      data: {
        agencyId,
        code: dto.code ?? null,
        name: dto.name,
        description: dto.description ?? null,
        durationMinutes: dto.duration_minutes ?? null,
      },
    });
    return { id: tour.id };
  }

  async findOne(agencyId: string, tourId: string) {
    const tour = await this.prisma.tour.findFirst({
      where: { id: tourId, agencyId },
    });
    if (!tour) throw notFound('Tour', tourId);
    return tour;
  }

  async update(agencyId: string, tourId: string, dto: UpdateTourDto) {
    const existing = await this.prisma.tour.findFirst({
      where: { id: tourId, agencyId },
    });
    if (!existing) throw notFound('Tour', tourId);

    await this.prisma.tour.update({
      where: { id: tourId },
      data: {
        ...(dto.name !== undefined ? { name: dto.name } : {}),
        ...(dto.description !== undefined ? { description: dto.description } : {}),
        ...(dto.duration_minutes !== undefined ? { durationMinutes: dto.duration_minutes } : {}),
        ...(dto.active !== undefined ? { active: dto.active } : {}),
      },
    });

    return { updated: true };
  }
}
