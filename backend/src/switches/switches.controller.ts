import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, ParseIntPipe, Patch, Post } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, IsUUID, Matches, Max, Min, MinLength, ValidateIf } from 'class-validator';
import { PortStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly, AuthUser, CanEdit, CurrentUser } from '../common/auth';
import { HistoryService } from '../history/history.service';
import { ConnectionsService, connectionInclude } from '../connections/connections.service';
import { StructureService } from '../structure/structure.service';
import { blank, optId, optText, effectivePortStatus, IPV4_REGEX, MAC_REGEX, normalizeMac, PORT_STATUS_LABEL, switchPortLabel } from '../common/format';

const notBlank = (_: unknown, v: unknown) => v !== null && v !== undefined && v !== '';

class SwitchDto {
  @IsString() @MinLength(1, { message: 'Informe o nome do switch' }) name: string;
  @IsOptional() @IsString() manufacturer?: string | null;
  @IsOptional() @IsString() model?: string | null;
  @Type(() => Number) @IsInt() @Min(1) @Max(512) portCount: number;
  @ValidateIf(notBlank) @Matches(IPV4_REGEX, { message: 'Endereço IP inválido' }) ipAddress?: string | null;
  @ValidateIf(notBlank) @Matches(MAC_REGEX, { message: 'Endereço MAC inválido' }) macAddress?: string | null;
  @IsOptional() @IsUUID() roomId?: string | null;
  @IsOptional() @IsUUID() rackId?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

class PortUpdateDto {
  @IsOptional() @IsEnum(PortStatus) status?: PortStatus;
  @IsOptional() @IsString() notes?: string | null;
  /** Ponto de rede ligado a esta porta. null = desconectar. */
  @IsOptional() @IsUUID() networkPointId?: string | null;
}

type PortLike = { status: PortStatus; connection: { id: string } | null };

export function portUsage(ports: PortLike[]) {
  const usage = { total: ports.length, used: 0, available: 0, reserved: 0, disabled: 0, faulty: 0 };
  for (const p of ports) {
    const s = effectivePortStatus(p.status, Boolean(p.connection));
    if (s === 'IN_USE') usage.used++;
    else if (s === 'AVAILABLE') usage.available++;
    else if (s === 'RESERVED') usage.reserved++;
    else if (s === 'DISABLED') usage.disabled++;
    else usage.faulty++;
  }
  return usage;
}

const switchData = (dto: SwitchDto) => ({
  name: dto.name.trim(),
  manufacturer: optText(dto.manufacturer),
  model: optText(dto.model),
  portCount: dto.portCount,
  ipAddress: optText(dto.ipAddress),
  macAddress: dto.macAddress === undefined ? undefined : normalizeMac(optText(dto.macAddress)),
  roomId: optId(dto.roomId),
  rackId: optId(dto.rackId),
  notes: optText(dto.notes),
});

@Controller('switches')
export class SwitchesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    private readonly connections: ConnectionsService,
    private readonly structure: StructureService,
  ) {}

  @Get()
  async list() {
    const [switches, paths] = await Promise.all([
      this.prisma.switch.findMany({
        orderBy: { name: 'asc' },
        include: { rack: true, room: true, ports: { select: { status: true, connection: { select: { id: true } } } } },
      }),
      this.structure.locationPaths(),
    ]);
    return switches.map(({ ports, ...s }) => ({ ...s, location: this.structure.roomPath(paths, s.room), usage: portUsage(ports) }));
  }

  /** Switch com todas as portas e o que está conectado em cada uma — base da tela "frente do switch". */
  @Get(':id')
  async get(@Param('id') id: string) {
    const [sw, paths] = await Promise.all([
      this.prisma.switch.findUnique({
        where: { id },
        include: { rack: true, room: true, ports: { orderBy: { number: 'asc' }, include: { connection: { include: connectionInclude } } } },
      }),
      this.structure.locationPaths(),
    ]);
    if (!sw) throw new NotFoundException('Switch não encontrado');
    const { ports, ...rest } = sw;
    return {
      ...rest,
      location: this.structure.roomPath(paths, sw.room),
      usage: portUsage(ports),
      ports: ports.map(({ connection, ...p }) => ({
        id: p.id,
        number: p.number,
        storedStatus: p.status,
        status: effectivePortStatus(p.status, Boolean(connection)),
        notes: p.notes,
        trace: connection ? this.connections.toTrace(connection, paths) : null,
      })),
    };
  }

  @CanEdit()
  @Post()
  async create(@Body() dto: SwitchDto, @CurrentUser() me: AuthUser) {
    await this.ensureUniqueName(dto.name);
    return this.prisma.$transaction(async (tx) => {
      const sw = await tx.switch.create({ data: switchData(dto) });
      await this.connections.resizePorts(tx, 'switch', sw.id, sw.portCount);
      await this.history.log(me, { entityType: 'Switch', entityId: sw.id, entityLabel: sw.name, action: 'CREATE', newValue: `${sw.portCount} portas` }, tx);
      return sw;
    });
  }

  @CanEdit()
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: SwitchDto, @CurrentUser() me: AuthUser) {
    await this.ensureUniqueName(dto.name, id);
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.switch.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Switch não encontrado');
      const sw = await tx.switch.update({ where: { id }, data: switchData(dto) });
      if (sw.portCount !== before.portCount) await this.connections.resizePorts(tx, 'switch', id, sw.portCount);
      await this.history.logDiff(me, 'Switch', id, sw.name, before, sw, {
        name: 'Nome', manufacturer: 'Fabricante', model: 'Modelo', portCount: 'Quantidade de portas',
        ipAddress: 'IP', macAddress: 'MAC', notes: 'Observações',
      }, tx);
      return sw;
    });
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const sw = await this.prisma.switch.delete({ where: { id } });
    await this.history.log(me, { entityType: 'Switch', entityId: id, entityLabel: sw.name, action: 'DELETE' });
    return { ok: true };
  }

  // ---------------------------------------------------------------- Portas

  @Get(':id/ports/:number')
  async port(@Param('id') id: string, @Param('number', ParseIntPipe) number: number) {
    const port = await this.prisma.switchPort.findUnique({ where: { switchId_number: { switchId: id, number } }, include: { connection: true } });
    if (!port) throw new NotFoundException('Porta não encontrada');
    return {
      id: port.id,
      number: port.number,
      storedStatus: port.status,
      status: effectivePortStatus(port.status, Boolean(port.connection)),
      notes: port.notes,
      trace: await this.connections.trace({ switchPortId: port.id }),
    };
  }

  @CanEdit()
  @Patch(':id/ports/:number')
  async updatePort(
    @Param('id') id: string,
    @Param('number', ParseIntPipe) number: number,
    @Body() dto: PortUpdateDto,
    @CurrentUser() me: AuthUser,
  ) {
    const port = await this.prisma.switchPort.findUnique({ where: { switchId_number: { switchId: id, number } }, include: { switch: true, connection: true } });
    if (!port) throw new NotFoundException('Porta não encontrada');
    const label = switchPortLabel(port.switch.name, number);

    if (dto.networkPointId !== undefined && (dto.networkPointId || null) !== (port.connection?.networkPointId ?? null)) {
      await this.connections.linkSwitchPort(port.id, dto.networkPointId || null, me);
    }
    if (dto.status && dto.status !== port.status) {
      await this.prisma.switchPort.update({ where: { id: port.id }, data: { status: dto.status } });
      await this.history.log(me, {
        entityType: 'Switch', entityId: id, entityLabel: label, action: 'UPDATE', field: 'Status da porta',
        previousValue: PORT_STATUS_LABEL[port.status], newValue: PORT_STATUS_LABEL[dto.status],
      });
    }
    if (dto.notes !== undefined && blank(dto.notes) !== port.notes) {
      await this.prisma.switchPort.update({ where: { id: port.id }, data: { notes: blank(dto.notes) } });
      await this.history.log(me, {
        entityType: 'Switch', entityId: id, entityLabel: label, action: 'UPDATE', field: 'Observações da porta',
        previousValue: port.notes, newValue: blank(dto.notes),
      });
    }
    return this.port(id, number);
  }

  private async ensureUniqueName(name: string, ignoreId?: string) {
    const clash = await this.prisma.switch.findUnique({ where: { name: name.trim() } });
    if (clash && clash.id !== ignoreId) throw new ConflictException('Já existe um switch com este nome');
  }
}
