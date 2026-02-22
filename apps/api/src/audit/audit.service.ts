import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface AuditLogEntry {
  agencyId: string;
  entityType: string;
  entityId: string;
  action: string;
  changes: Record<string, unknown>;
  createdBy: string;
}

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditLogEntry): Promise<void> {
    await this.prisma.auditLog.create({
      data: {
        agencyId: entry.agencyId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        changes: entry.changes,
        createdBy: entry.createdBy,
      },
    });
  }

  /**
   * Log inside an existing Prisma transaction.
   * Pass the tx client from prisma.$transaction().
   */
  async logTx(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    tx: any,
    entry: AuditLogEntry,
  ): Promise<void> {
    await tx.auditLog.create({
      data: {
        agencyId: entry.agencyId,
        entityType: entry.entityType,
        entityId: entry.entityId,
        action: entry.action,
        changes: entry.changes,
        createdBy: entry.createdBy,
      },
    });
  }

  async list(
    agencyId: string,
    entityType?: string,
    entityId?: string,
    from?: string,
    to?: string,
    page = 1,
    pageSize = 50,
  ) {
    const where = {
      agencyId,
      ...(entityType ? { entityType } : {}),
      ...(entityId ? { entityId } : {}),
      ...(from || to
        ? {
            createdAt: {
              ...(from ? { gte: new Date(from) } : {}),
              ...(to ? { lte: new Date(to) } : {}),
            },
          }
        : {}),
    };

    const [total, entries] = await Promise.all([
      this.prisma.auditLog.count({ where }),
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);

    return { entries, total, page, pageSize };
  }
}
