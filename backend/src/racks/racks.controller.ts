import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min, MinLength } from 'class-validator';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly, AuthUser, CanEdit, CurrentUser } from '../common/auth';
import { HistoryService } from '../history/history.service';
import { ConnectionsService, connectionInclude } from '../connections/connections.service';
import { StructureService } from '../structure/structure.service';
import { blank, optId, optText } from '../common/format';
import { portUsage } from '../switches/switches.controller';

class RackDto {
  @IsString() @MinLength(1, { message: 'Informe o nome do rack' }) name: string;
  @IsOptional() @IsUUID() roomId?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

class PatchPanelDto {
  @IsString() @MinLength(1, { message: 'Informe o nome do patch panel' }) name: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(512) portCount: number;
  @IsOptional() @IsUUID() rackId?: string | null;
  @IsOptional() @IsString() notes?: string | null;
}

// ---------------------------------------------------------------- Racks

@Controller('racks')
export class RacksController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    private readonly structure: StructureService,
  ) {}

  @Get()
  async list() {
    const [racks, paths] = await Promise.all([
      this.prisma.rack.findMany({ orderBy: { name: 'asc' }, include: { room: true, _count: { select: { switches: true, patchPanels: true } } } }),
      this.structure.locationPaths(),
    ]);
    return racks.map((r) => ({ ...r, location: this.structure.roomPath(paths, r.room) }));
  }

  /** Rack com seus switches (e ocupação) e patch panels — aberto também pelo QR Code do rack. */
  @Get(':id')
  async get(@Param('id') id: string) {
    const [rack, paths] = await Promise.all([
      this.prisma.rack.findUnique({
        where: { id },
        include: {
          room: true,
          switches: { orderBy: { name: 'asc' }, include: { ports: { select: { status: true, linkedPortId: true, connection: { select: { id: true } } } } } },
          patchPanels: { orderBy: { name: 'asc' }, include: { ports: { select: { connection: { select: { id: true } } } } } },
        },
      }),
      this.structure.locationPaths(),
    ]);
    if (!rack) throw new NotFoundException('Rack não encontrado');
    return {
      ...rack,
      location: this.structure.roomPath(paths, rack.room),
      switches: rack.switches.map(({ ports, ...s }) => ({ ...s, usage: portUsage(ports) })),
      patchPanels: rack.patchPanels.map(({ ports, ...p }) => ({ ...p, usedPorts: ports.filter((x) => x.connection).length })),
    };
  }

  @CanEdit()
  @Post()
  async create(@Body() dto: RackDto, @CurrentUser() me: AuthUser) {
    await this.ensureUniqueName(dto.name);
    const rack = await this.prisma.rack.create({ data: { name: dto.name.trim(), roomId: dto.roomId || null, notes: blank(dto.notes) } });
    await this.history.log(me, { entityType: 'Rack', entityId: rack.id, entityLabel: rack.name, action: 'CREATE' });
    return rack;
  }

  @CanEdit()
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: RackDto, @CurrentUser() me: AuthUser) {
    await this.ensureUniqueName(dto.name, id);
    const before = await this.prisma.rack.findUniqueOrThrow({ where: { id } });
    const rack = await this.prisma.rack.update({ where: { id }, data: { name: dto.name.trim(), roomId: optId(dto.roomId), notes: optText(dto.notes) } });
    await this.history.logDiff(me, 'Rack', id, rack.name, before, rack, { name: 'Nome', notes: 'Observações' });
    return rack;
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const rack = await this.prisma.rack.delete({ where: { id } });
    await this.history.log(me, { entityType: 'Rack', entityId: id, entityLabel: rack.name, action: 'DELETE' });
    return { ok: true };
  }

  private async ensureUniqueName(name: string, ignoreId?: string) {
    const clash = await this.prisma.rack.findUnique({ where: { name: name.trim() } });
    if (clash && clash.id !== ignoreId) throw new ConflictException('Já existe um rack com este nome');
  }
}

// ---------------------------------------------------------------- Patch panels

@Controller('patch-panels')
export class PatchPanelsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    private readonly connections: ConnectionsService,
    private readonly structure: StructureService,
  ) {}

  @Get()
  async list(@Query('rackId') rackId?: string) {
    const panels = await this.prisma.patchPanel.findMany({
      where: { rackId: rackId || undefined },
      orderBy: [{ rack: { name: 'asc' } }, { name: 'asc' }],
      include: { rack: true, ports: { select: { connection: { select: { id: true } } } } },
    });
    return panels.map(({ ports, ...p }) => ({ ...p, usedPorts: ports.filter((x) => x.connection).length }));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const [panel, paths] = await Promise.all([
      this.prisma.patchPanel.findUnique({
        where: { id },
        include: { rack: true, ports: { orderBy: { number: 'asc' }, include: { connection: { include: connectionInclude } } } },
      }),
      this.structure.locationPaths(),
    ]);
    if (!panel) throw new NotFoundException('Patch panel não encontrado');
    return {
      ...panel,
      ports: panel.ports.map(({ connection, ...p }) => ({ ...p, trace: connection ? this.connections.toTrace(connection, paths) : null })),
    };
  }

  @CanEdit()
  @Post()
  async create(@Body() dto: PatchPanelDto, @CurrentUser() me: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const panel = await tx.patchPanel.create({
        data: { name: dto.name.trim(), portCount: dto.portCount, rackId: dto.rackId || null, notes: blank(dto.notes) },
      });
      await this.connections.resizePorts(tx, 'patchPanel', panel.id, panel.portCount);
      await this.history.log(me, { entityType: 'PatchPanel', entityId: panel.id, entityLabel: panel.name, action: 'CREATE' }, tx);
      return panel;
    });
  }

  @CanEdit()
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: PatchPanelDto, @CurrentUser() me: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.patchPanel.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Patch panel não encontrado');
      const panel = await tx.patchPanel.update({
        where: { id },
        data: { name: dto.name.trim(), portCount: dto.portCount, rackId: optId(dto.rackId), notes: optText(dto.notes) },
      });
      if (panel.portCount !== before.portCount) await this.connections.resizePorts(tx, 'patchPanel', id, panel.portCount);
      await this.history.logDiff(me, 'PatchPanel', id, panel.name, before, panel, { name: 'Nome', portCount: 'Quantidade de portas' }, tx);
      return panel;
    });
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const panel = await this.prisma.patchPanel.delete({ where: { id } });
    await this.history.log(me, { entityType: 'PatchPanel', entityId: id, entityLabel: panel.name, action: 'DELETE' });
    return { ok: true };
  }
}
