import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { notFound } from '../common/errors';

@Injectable()
export class AgenciesService {
  constructor(private readonly prisma: PrismaService) {}

  async getMyAgencies(userId: string) {
    const memberships = await this.prisma.agencyUser.findMany({
      where: { userId, status: 'ACTIVE' },
      include: { agency: true },
    });

    return memberships.map((m) => ({
      id: m.agency.id,
      name: m.agency.name,
      role: m.role,
      defaultCurrency: m.agency.defaultCurrency,
      timezone: m.agency.timezone,
    }));
  }

  async listUsers(agencyId: string) {
    return this.prisma.agencyUser.findMany({
      where: { agencyId },
      include: { user: true },
    });
  }

  async updateUserRole(
    agencyId: string,
    userId: string,
    role: string,
    status: string,
  ) {
    const membership = await this.prisma.agencyUser.findFirst({
      where: { agencyId, userId },
    });
    if (!membership) throw notFound('AgencyUser');

    await this.prisma.agencyUser.update({
      where: { id: membership.id },
      data: { role, status },
    });

    return { updated: true };
  }
}
