import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth';
import { Db, HistoryService } from '../history/history.service';
import { StructureService } from '../structure/structure.service';
import { effectivePortStatus, patchPortLabel, switchPortLabel } from '../common/format';

export const connectionInclude = {
  device: { include: { department: true, room: true } },
  networkPoint: { include: { room: true, department: true } },
  patchPanelPort: { include: { patchPanel: { include: { rack: true } } } },
  switchPort: { include: { switch: { include: { rack: true, room: true } } } },
} satisfies Prisma.ConnectionInclude;

export type FullConnection = Prisma.ConnectionGetPayload<{ include: typeof connectionInclude }>;

/** Caminho físico completo, pronto para a tela "Rastrear conexão". */
export interface Trace {
  connectionId: string | null;
  device: {
    id: string;
    name: string;
    type: string;
    responsibleUser: string | null;
    department: string | null;
    room: string | null;
    hostname: string | null;
    ipAddress: string | null;
    macAddress: string | null;
    assetTag: string | null;
    extension: string | null;
  } | null;
  point: { id: string; code: string; room: string | null; location: string | null; department: string | null } | null;
  patchPanel: { id: string; name: string; portId: string; port: number; rack: string | null } | null;
  switch: {
    id: string;
    name: string;
    portId: string;
    port: number;
    status: string;
    ipAddress: string | null;
    rack: string | null;
    location: string | null;
  } | null;
  cableLabel: string | null;
  complete: boolean;
}

type DeviceWithRefs = Prisma.DeviceGetPayload<{ include: { department: true; room: true } }>;

export const deviceSummary = (d: DeviceWithRefs): NonNullable<Trace['device']> => ({
  id: d.id,
  name: d.name,
  type: d.type,
  responsibleUser: d.responsibleUser,
  department: d.department?.name ?? null,
  room: d.room?.name ?? null,
  hostname: d.hostname,
  ipAddress: d.ipAddress,
  macAddress: d.macAddress,
  assetTag: d.assetTag,
  extension: d.extension,
});

export const emptyTrace = (): Trace => ({
  connectionId: null, device: null, point: null, patchPanel: null, switch: null, cableLabel: null, complete: false,
});

/** Campos da conexão que podem ser alterados. `undefined` = não alterar, `null` = desconectar. */
export interface LinkInput {
  deviceId?: string | null;
  patchPanelPortId?: string | null;
  switchPortId?: string | null;
  cableLabel?: string | null;
}

type LinkKey = 'deviceId' | 'patchPanelPortId' | 'switchPortId';
const LINK_FIELDS: Record<LinkKey, string> = {
  deviceId: 'Equipamento',
  patchPanelPortId: 'Porta do patch panel',
  switchPortId: 'Porta do switch',
};

@Injectable()
export class ConnectionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    private readonly structure: StructureService,
  ) {}

  // ------------------------------------------------------------------ Rastreamento

  toTrace(c: FullConnection, paths: Map<string, string>): Trace {
    const d = c.device;
    const p = c.networkPoint;
    const pp = c.patchPanelPort;
    const sp = c.switchPort;
    return {
      connectionId: c.id,
      device: d && deviceSummary(d),
      point: p && {
        id: p.id,
        code: p.code,
        room: p.room?.name ?? null,
        location: this.structure.roomPath(paths, p.room),
        department: p.department?.name ?? null,
      },
      patchPanel: pp && {
        id: pp.patchPanel.id,
        name: pp.patchPanel.name,
        portId: pp.id,
        port: pp.number,
        rack: pp.patchPanel.rack?.name ?? null,
      },
      switch: sp && {
        id: sp.switch.id,
        name: sp.switch.name,
        portId: sp.id,
        port: sp.number,
        status: effectivePortStatus(sp.status, true),
        ipAddress: sp.switch.ipAddress,
        rack: sp.switch.rack?.name ?? null,
        location: this.structure.roomPath(paths, sp.switch.room),
      },
      cableLabel: c.cableLabel,
      complete: Boolean(d && sp),
    };
  }

  async tracesFor(where: Prisma.ConnectionWhereInput, take = 50): Promise<Trace[]> {
    const [conns, paths] = await Promise.all([
      this.prisma.connection.findMany({ where, include: connectionInclude, take }),
      this.structure.locationPaths(),
    ]);
    return conns.map((c) => this.toTrace(c, paths));
  }

  /** Rastreia a partir de qualquer elemento. Retorna um caminho parcial se o elemento não estiver conectado. */
  async trace(q: { deviceId?: string; pointId?: string; switchPortId?: string; patchPanelPortId?: string; connectionId?: string }): Promise<Trace> {
    const where: Prisma.ConnectionWhereUniqueInput | null = q.connectionId
      ? { id: q.connectionId }
      : q.deviceId
        ? { deviceId: q.deviceId }
        : q.pointId
          ? { networkPointId: q.pointId }
          : q.switchPortId
            ? { switchPortId: q.switchPortId }
            : q.patchPanelPortId
              ? { patchPanelPortId: q.patchPanelPortId }
              : null;
    if (!where) throw new BadRequestException('Informe o elemento a rastrear');

    const paths = await this.structure.locationPaths();
    const conn = await this.prisma.connection.findUnique({ where, include: connectionInclude });
    if (conn) return this.toTrace(conn, paths);

    // Elemento sem conexão: devolve somente ele mesmo
    const empty = emptyTrace();
    if (q.deviceId) {
      const d = await this.prisma.device.findUnique({ where: { id: q.deviceId }, include: { department: true, room: true } });
      if (!d) throw new NotFoundException('Equipamento não encontrado');
      empty.device = deviceSummary(d);
    } else if (q.pointId) {
      const p = await this.prisma.networkPoint.findUnique({ where: { id: q.pointId }, include: { room: true, department: true } });
      if (!p) throw new NotFoundException('Ponto de rede não encontrado');
      empty.point = { id: p.id, code: p.code, room: p.room?.name ?? null, location: this.structure.roomPath(paths, p.room), department: p.department?.name ?? null };
    } else if (q.switchPortId) {
      const sp = await this.prisma.switchPort.findUnique({ where: { id: q.switchPortId }, include: { switch: { include: { rack: true, room: true } } } });
      if (!sp) throw new NotFoundException('Porta não encontrada');
      empty.switch = {
        id: sp.switch.id, name: sp.switch.name, portId: sp.id, port: sp.number, status: effectivePortStatus(sp.status, false),
        ipAddress: sp.switch.ipAddress, rack: sp.switch.rack?.name ?? null, location: this.structure.roomPath(paths, sp.switch.room),
      };
    } else if (q.patchPanelPortId) {
      const pp = await this.prisma.patchPanelPort.findUnique({ where: { id: q.patchPanelPortId }, include: { patchPanel: { include: { rack: true } } } });
      if (!pp) throw new NotFoundException('Porta não encontrada');
      empty.patchPanel = { id: pp.patchPanel.id, name: pp.patchPanel.name, portId: pp.id, port: pp.number, rack: pp.patchPanel.rack?.name ?? null };
    }
    return empty;
  }

  // ------------------------------------------------------------------ Resolução de portas

  async resolveSwitchPort(switchId: string | null | undefined, number: number | null | undefined, db: Db = this.prisma) {
    if (switchId === undefined) return undefined;
    if (switchId === null || number === null || number === undefined) return null;
    const port = await db.switchPort.findUnique({ where: { switchId_number: { switchId, number } } });
    if (!port) throw new BadRequestException(`A porta ${number} não existe neste switch`);
    return port.id;
  }

  async resolvePatchPort(patchPanelId: string | null | undefined, number: number | null | undefined, db: Db = this.prisma) {
    if (patchPanelId === undefined) return undefined;
    if (patchPanelId === null || number === null || number === undefined) return null;
    const port = await db.patchPanelPort.findUnique({ where: { patchPanelId_number: { patchPanelId, number } } });
    if (!port) throw new BadRequestException(`A porta ${number} não existe neste patch panel`);
    return port.id;
  }

  // ------------------------------------------------------------------ Alteração de conexões

  /**
   * Altera o caminho físico de um ponto de rede. Se o equipamento/porta escolhido
   * já estiver ligado a outro ponto, ele é desligado de lá (e isso fica no histórico).
   */
  link(pointId: string, input: LinkInput, user: AuthUser | null, db?: Prisma.TransactionClient) {
    if (db) return this.linkIn(db, pointId, input, user);
    return this.prisma.$transaction((tx) => this.linkIn(tx, pointId, input, user));
  }

  /** Liga um equipamento a um ponto (ou desliga, com pointId = null). */
  async linkDevice(deviceId: string, pointId: string | null, user: AuthUser | null, db?: Prisma.TransactionClient) {
    const run = async (tx: Prisma.TransactionClient) => {
      if (pointId) return this.linkIn(tx, pointId, { deviceId }, user);
      const current = await tx.connection.findUnique({ where: { deviceId } });
      if (current) await this.linkIn(tx, current.networkPointId, { deviceId: null }, user);
    };
    return db ? run(db) : this.prisma.$transaction(run);
  }

  /** Liga uma porta de switch a um ponto (ou desliga, com pointId = null). */
  async linkSwitchPort(switchPortId: string, pointId: string | null, user: AuthUser | null) {
    return this.prisma.$transaction(async (tx) => {
      if (pointId) return this.linkIn(tx, pointId, { switchPortId }, user);
      const current = await tx.connection.findUnique({ where: { switchPortId } });
      if (current) await this.linkIn(tx, current.networkPointId, { switchPortId: null }, user);
    });
  }

  /**
   * Liga (ou desliga, com targetPortId = null) duas portas de switches diferentes — o cabo
   * de comunicação entre switches. O vínculo é gravado nos dois lados; se alguma das portas
   * já tinha outro uplink, ele é desfeito.
   */
  async linkUplink(portId: string, targetPortId: string | null, user: AuthUser | null) {
    return this.prisma.$transaction(async (tx) => {
      const portInclude = { switch: true, connection: { include: { networkPoint: true } } } as const;
      const port = await tx.switchPort.findUnique({ where: { id: portId }, include: portInclude });
      if (!port) throw new NotFoundException('Porta não encontrada');
      const label = switchPortLabel(port.switch.name, port.number);

      if (targetPortId) {
        const target = await tx.switchPort.findUnique({ where: { id: targetPortId }, include: portInclude });
        if (!target) throw new NotFoundException('Porta do outro switch não encontrada');
        if (target.switchId === port.switchId) throw new BadRequestException('O uplink precisa ligar dois switches diferentes');
        for (const p of [port, target]) {
          if (p.connection) {
            throw new BadRequestException(`${switchPortLabel(p.switch.name, p.number)} está ligada ao ponto ${p.connection.networkPoint.code}. Desconecte o ponto antes.`);
          }
        }
        await this.unlinkUplink(tx, port.id, user);
        await this.unlinkUplink(tx, target.id, user);
        await tx.switchPort.update({ where: { id: port.id }, data: { linkedPortId: target.id } });
        await tx.switchPort.update({ where: { id: target.id }, data: { linkedPortId: port.id } });
        // Porta reservada que recebe uplink deixa de ser reserva
        await tx.switchPort.updateMany({ where: { id: { in: [port.id, target.id] }, status: 'RESERVED' }, data: { status: 'AVAILABLE' } });

        const targetLabel = switchPortLabel(target.switch.name, target.number);
        for (const [p, a, b] of [[port, label, targetLabel], [target, targetLabel, label]] as const) {
          await this.history.log(user, {
            entityType: 'Switch', entityId: p.switchId, entityLabel: a, action: 'CONNECT', field: 'Uplink', newValue: b,
          }, tx);
        }
      } else {
        await this.unlinkUplink(tx, port.id, user);
      }
    });
  }

  private async unlinkUplink(tx: Prisma.TransactionClient, portId: string, user: AuthUser | null) {
    const port = await tx.switchPort.findUnique({ where: { id: portId }, include: { switch: true, linkedPort: { include: { switch: true } } } });
    const other = port?.linkedPort;
    if (!port || !other) return;
    await tx.switchPort.updateMany({ where: { id: { in: [port.id, other.id] } }, data: { linkedPortId: null } });
    const label = switchPortLabel(port.switch.name, port.number);
    const otherLabel = switchPortLabel(other.switch.name, other.number);
    for (const [p, a, b] of [[port, label, otherLabel], [other, otherLabel, label]] as const) {
      await this.history.log(user, {
        entityType: 'Switch', entityId: p.switchId, entityLabel: a, action: 'DISCONNECT', field: 'Uplink', previousValue: b, newValue: null,
      }, tx);
    }
  }

  private async linkIn(tx: Prisma.TransactionClient, pointId: string, input: LinkInput, user: AuthUser | null) {
    const point = await tx.networkPoint.findUnique({ where: { id: pointId } });
    if (!point) throw new NotFoundException('Ponto de rede não encontrado');
    const current = await tx.connection.findUnique({ where: { networkPointId: pointId } });

    const changes: Partial<Record<LinkKey, string | null>> = {};
    for (const key of Object.keys(LINK_FIELDS) as LinkKey[]) {
      const next = input[key];
      if (next === undefined || next === (current?.[key] ?? null)) continue;
      changes[key] = next;

      // Libera o elemento se ele estiver em outra conexão
      if (next) {
        const other = await tx.connection.findFirst({ where: { [key]: next, NOT: { networkPointId: pointId } }, include: { networkPoint: true } });
        if (other) {
          await tx.connection.update({ where: { id: other.id }, data: { [key]: null } });
          await this.history.log(user, {
            entityType: 'NetworkPoint',
            entityId: other.networkPointId,
            entityLabel: other.networkPoint.code,
            action: 'DISCONNECT',
            field: LINK_FIELDS[key],
            previousValue: await this.labelFor(tx, key, next),
            newValue: null,
            description: `Movido para o ponto ${point.code}`,
          }, tx);
        }
      }
    }

    const cableChanged = input.cableLabel !== undefined && (input.cableLabel || null) !== (current?.cableLabel ?? null);
    if (!Object.keys(changes).length && !cableChanged) return current;

    if (changes.switchPortId) {
      const uplink = await tx.switchPort.findUnique({ where: { id: changes.switchPortId }, select: { linkedPortId: true } });
      if (uplink?.linkedPortId) throw new BadRequestException('Esta porta é um uplink para outro switch. Desfaça o uplink antes de ligar um ponto.');
      // Porta reservada que recebe conexão deixa de ser reserva
      await tx.switchPort.updateMany({ where: { id: changes.switchPortId, status: 'RESERVED' }, data: { status: 'AVAILABLE' } });
    }

    const data = { ...changes, ...(cableChanged ? { cableLabel: input.cableLabel || null } : {}) };
    const saved = await tx.connection.upsert({
      where: { networkPointId: pointId },
      create: { networkPointId: pointId, ...data },
      update: data,
    });

    // Histórico legível: "RH-PT-07 (Switch RH 01 · Porta 43) — Equipamento: PC do Lucas → PC da Mariana"
    const portId = saved.switchPortId;
    const portLabel = portId ? await this.labelFor(tx, 'switchPortId', portId) : null;
    const entityLabel = portLabel ? `${point.code} (${portLabel})` : point.code;
    for (const [key, next] of Object.entries(changes) as [LinkKey, string | null][]) {
      const prev = current?.[key] ?? null;
      await this.history.log(user, {
        entityType: 'NetworkPoint',
        entityId: pointId,
        entityLabel,
        action: next ? 'CONNECT' : 'DISCONNECT',
        field: LINK_FIELDS[key],
        previousValue: prev ? await this.labelFor(tx, key, prev) : null,
        newValue: next ? await this.labelFor(tx, key, next) : null,
      }, tx);
    }
    if (cableChanged) {
      await this.history.log(user, {
        entityType: 'NetworkPoint', entityId: pointId, entityLabel, action: 'UPDATE',
        field: 'Identificação do cabo', previousValue: current?.cableLabel ?? null, newValue: input.cableLabel || null,
      }, tx);
    }
    return saved;
  }

  private async labelFor(tx: Prisma.TransactionClient, key: LinkKey, id: string): Promise<string> {
    if (key === 'deviceId') {
      const d = await tx.device.findUnique({ where: { id } });
      return d ? d.name : '(removido)';
    }
    if (key === 'switchPortId') {
      const p = await tx.switchPort.findUnique({ where: { id }, include: { switch: true } });
      return p ? switchPortLabel(p.switch.name, p.number) : '(removido)';
    }
    const p = await tx.patchPanelPort.findUnique({ where: { id }, include: { patchPanel: true } });
    return p ? patchPortLabel(p.patchPanel.name, p.number) : '(removido)';
  }

  // ------------------------------------------------------------------ Portas

  /**
   * Ajusta a quantidade de portas de um switch ou patch panel.
   * Não permite remover portas que estejam conectadas.
   */
  async resizePorts(tx: Prisma.TransactionClient, kind: 'switch' | 'patchPanel', ownerId: string, count: number) {
    const model: any = kind === 'switch' ? tx.switchPort : tx.patchPanelPort;
    const ownerKey = kind === 'switch' ? 'switchId' : 'patchPanelId';
    const existing: { number: number; connection: { id: string } | null; linkedPortId?: string | null }[] = await model.findMany({
      where: { [ownerKey]: ownerId },
      select: { number: true, connection: { select: { id: true } }, ...(kind === 'switch' ? { linkedPortId: true } : {}) },
    });
    const numbers = new Set(existing.map((p) => p.number));
    const busy = existing.filter((p) => p.number > count && (p.connection || p.linkedPortId)).map((p) => p.number);
    if (busy.length) {
      throw new BadRequestException(`Não é possível reduzir: as portas ${busy.join(', ')} estão conectadas`);
    }
    await model.deleteMany({ where: { [ownerKey]: ownerId, number: { gt: count } } });
    const missing = Array.from({ length: count }, (_, i) => i + 1).filter((n) => !numbers.has(n));
    if (missing.length) await model.createMany({ data: missing.map((number) => ({ [ownerKey]: ownerId, number })) });
  }
}
