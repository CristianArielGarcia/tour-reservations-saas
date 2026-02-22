import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SupabaseService } from '../supabase/supabase.service';
import { notFound, validationError } from '../common/errors';

@Injectable()
export class AgenciesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly supabase: SupabaseService,
  ) {}

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

  async inviteUser(agencyId: string, email: string, role: string) {
    // Check if agency exists
    const agency = await this.prisma.agency.findUnique({
      where: { id: agencyId },
    });
    if (!agency) throw notFound('Agency');

    // Check if user already exists in Supabase with this email
    // First, try to invite the user via Supabase
    let userId: string;
    try {
      const { userId: invitedUserId } = await this.supabase.inviteUser(email);
      userId = invitedUserId;
    } catch (error) {
      // If error is that user already exists, we need to look them up
      // For now, we'll re-throw the error as unprocessable
      throw validationError(`User with email ${email} already exists or invitation failed`);
    }

    // Check if user is already a member of this agency
    const existingMembership = await this.prisma.agencyUser.findFirst({
      where: { agencyId, userId },
    });
    if (existingMembership) {
      throw validationError('User is already a member of this agency');
    }

    // Create agency user membership
    await this.prisma.agencyUser.create({
      data: {
        agencyId,
        userId,
        role,
        status: 'ACTIVE',
      },
    });

    return { invited: true };
  }
}
