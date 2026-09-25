import { Controller, Get, Module, Query } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ConnectionsService, Trace, connectionInclude, deviceSummary, emptyTrace } from '../connections/connections.service';
import { StructureService } from '../structure/structure.service';
import { DEVICE_TYPE_LABEL, normalizeMac, pad2 } from '../common/format';

export interface SearchResult {
  kind: 'device' | 'point' | 'port' | 'switch' | 'rack';
  id: string;
  title: string;
  subtitle: string | null;
  /** Para kind = port/switch: abre direto a tela do switch */
  switchId?: string;
  portNumber?: number;
  trace: Trace | null;
}

const ci = (text: string) => ({ contains: text, mode: 'insensitive' as const });

/**
 * Pesquisa global usada pela barra da tela inicial e pelo "Rastrear conexão".
 * Aceita nome do funcionário, equipamento, hostname, IP, MAC, patrimônio, ramal,
 * ponto de rede, switch, número de porta ("43") ou switch + porta ("RH 01 43").
 */
@Controller('search')
class SearchController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly connections: ConnectionsService,
    private readonly structure: StructureService,
  ) {}

  @Get()
  async search(@Query('q') raw = ''): Promise<{ query: string; results: SearchResult[] }> {
    const q = raw.trim();
    if (!q) return { query: q, results: [] };
    const paths = await this.structure.locationPaths();
    const results: SearchResult[] = [];

    // 1) Porta de switch: "43", "porta 43", "Switch RH 01 porta 43", "RH01 43"
    const looksLikeIp = /^\d{1,3}(\.\d{1,3}){1,3}\.?$/.test(q);
    const portMatch = looksLikeIp ? null : q.match(/^(.*?)[\s\-:#/]*(?:porta|port|p)?\s*(\d{1,3})$/i);
    if (portMatch) {
      const number = Number(portMatch[2]);
      const switchText = portMatch[1].trim();
      const bySwitch = switchText ? await this.prisma.switch.findMany({ where: { name: ci(switchText) }, select: { id: true } }) : [];
      const where: Prisma.SwitchPortWhereInput = switchText && bySwitch.length
        ? { number, switchId: { in: bySwitch.map((s) => s.id) } }
        : !switchText
          ? { number, OR: [{ connection: { isNot: null } }, { status: { not: 'AVAILABLE' } }] }
          : { id: '__none__' };
      const ports = await this.prisma.switchPort.findMany({
        where,
        take: 20,
        orderBy: { switch: { name: 'asc' } },
        include: { switch: true, connection: { include: connectionInclude } },
      });
      for (const p of ports) {
        const trace = p.connection ? this.connections.toTrace(p.connection, paths) : null;
        results.push({
          kind: 'port',
          id: p.id,
          title: `${p.switch.name} · Porta ${pad2(p.number)}`,
          subtitle: trace?.device ? `Conectado ao ${trace.device.name}` : trace?.point ? `Ponto ${trace.point.code}` : 'Sem conexão',
          switchId: p.switchId,
          portNumber: p.number,
          trace,
        });
      }
    }

    // 2) Equipamentos
    const mac = normalizeMac(q);
    const devices = await this.prisma.device.findMany({
      where: {
        OR: [
          { name: ci(q) },
          { responsibleUser: ci(q) },
          { hostname: ci(q) },
          { ipAddress: { contains: q } },
          { macAddress: ci(mac ?? q) },
          { assetTag: ci(q) },
          { extension: { contains: q } },
          { department: { name: ci(q) } },
        ],
      },
      take: 25,
      orderBy: { name: 'asc' },
      include: { department: true, room: true, connection: { include: connectionInclude } },
    });
    for (const d of devices) {
      const trace = d.connection ? this.connections.toTrace(d.connection, paths) : { ...emptyTrace(), device: deviceSummary(d) };
      results.push({
        kind: 'device',
        id: d.id,
        title: d.name,
        subtitle: [d.responsibleUser, d.department?.name, DEVICE_TYPE_LABEL[d.type]].filter(Boolean).join(' · ') || null,
        trace,
      });
    }

    // 3) Pontos de rede
    const points = await this.prisma.networkPoint.findMany({
      where: { OR: [{ code: ci(q) }, { room: { name: ci(q) } }] },
      take: 20,
      orderBy: { code: 'asc' },
      include: { room: true, department: true, connection: { include: connectionInclude } },
    });
    for (const p of points) {
      if (results.some((r) => r.trace?.point?.id === p.id && r.kind === 'device')) continue;
      const trace = p.connection
        ? this.connections.toTrace(p.connection, paths)
        : { ...emptyTrace(), point: { id: p.id, code: p.code, room: p.room?.name ?? null, location: this.structure.roomPath(paths, p.room), department: p.department?.name ?? null } };
      results.push({ kind: 'point', id: p.id, title: `Ponto ${p.code}`, subtitle: this.structure.roomPath(paths, p.room), trace });
    }

    // 4) Switches e racks
    const [switches, racks] = await Promise.all([
      this.prisma.switch.findMany({ where: { OR: [{ name: ci(q) }, { ipAddress: { contains: q } }, { model: ci(q) }, { macAddress: ci(mac ?? q) }] }, take: 10 }),
      this.prisma.rack.findMany({ where: { name: ci(q) }, take: 10, include: { room: true } }),
    ]);
    for (const s of switches) {
      results.push({ kind: 'switch', id: s.id, title: s.name, subtitle: [s.model, s.ipAddress, `${s.portCount} portas`].filter(Boolean).join(' · '), switchId: s.id, trace: null });
    }
    for (const r of racks) {
      results.push({ kind: 'rack', id: r.id, title: r.name, subtitle: this.structure.roomPath(paths, r.room), trace: null });
    }

    return { query: q, results };
  }
}

@Module({ controllers: [SearchController] })
export class SearchModule {}
