import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth';

export type Db = PrismaService | Prisma.TransactionClient;

export interface HistoryEntry {
  entityType: string;
  entityId?: string | null;
  entityLabel: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CONNECT' | 'DISCONNECT' | 'IMPORT';
  field?: string | null;
  previousValue?: string | null;
  newValue?: string | null;
  description?: string | null;
}

const display = (v: unknown): string | null => {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'boolean') return v ? 'Sim' : 'Não';
  return String(v);
};

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  log(user: AuthUser | null, entry: HistoryEntry, db: Db = this.prisma) {
    return db.connectionHistory.create({
      data: {
        ...entry,
        userId: user?.sub ?? null,
        userName: user?.name ?? 'Sistema',
      },
    });
  }

  /**
   * Registra uma linha de histórico para cada campo alterado.
   * `labels` define quais campos são acompanhados e o nome amigável exibido.
   */
  async logDiff(
    user: AuthUser | null,
    entityType: string,
    entityId: string,
    entityLabel: string,
    before: Record<string, any>,
    after: Record<string, any>,
    labels: Record<string, string>,
    db: Db = this.prisma,
  ) {
    for (const [key, label] of Object.entries(labels)) {
      const prev = display(before[key]);
      const next = display(after[key]);
      if (prev !== next) {
        await this.log(user, { entityType, entityId, entityLabel, action: 'UPDATE', field: label, previousValue: prev, newValue: next }, db);
      }
    }
  }

  list(params: { entityType?: string; entityId?: string; take?: number; skip?: number }) {
    return this.prisma.connectionHistory.findMany({
      where: { entityType: params.entityType, entityId: params.entityId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(params.take ?? 50, 200),
      skip: params.skip ?? 0,
    });
  }
}
