import { BadRequestException, Body, ConflictException, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID, MinLength } from 'class-validator';
import { LocationType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly, AuthUser, CanEdit, CurrentUser } from '../common/auth';
import { HistoryService } from '../history/history.service';
import { StructureService } from './structure.service';

class LocationDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsEnum(LocationType) type?: LocationType;
  @IsOptional() @IsUUID() parentId?: string | null;
}

class RoomDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsUUID() locationId?: string | null;
  @IsOptional() @IsUUID() departmentId?: string | null;
}

class DepartmentDto {
  @IsString() @MinLength(1) name: string;
}

// ---------------------------------------------------------------- Locais

@Controller('locations')
export class LocationsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly structure: StructureService,
    private readonly history: HistoryService,
  ) {}

  /** Lista plana com o caminho completo de cada local. */
  @Get()
  async list() {
    const [locations, paths] = await Promise.all([
      this.prisma.location.findMany({
        orderBy: { name: 'asc' },
        include: { _count: { select: { children: true, rooms: true } } },
      }),
      this.structure.locationPaths(),
    ]);
    return locations
      .map((l) => ({ ...l, path: paths.get(l.id) ?? l.name }))
      .sort((a, b) => a.path.localeCompare(b.path, 'pt-BR'));
  }

  /** Árvore completa Prédio › Bloco › Andar › Salas, usada na tela "Locais". */
  @Get('tree')
  async tree() {
    const [locations, rooms] = await Promise.all([
      this.prisma.location.findMany({ orderBy: { name: 'asc' } }),
      this.prisma.room.findMany({
        orderBy: { name: 'asc' },
        include: { department: true, _count: { select: { devices: true, points: true, racks: true } } },
      }),
    ]);
    type Node = (typeof locations)[number] & { children: Node[]; rooms: typeof rooms };
    const nodes = new Map<string, Node>(locations.map((l) => [l.id, { ...l, children: [], rooms: [] }]));
    const roots: Node[] = [];
    for (const n of nodes.values()) {
      const parent = n.parentId ? nodes.get(n.parentId) : undefined;
      (parent ? parent.children : roots).push(n);
    }
    for (const r of rooms) if (r.locationId) nodes.get(r.locationId)?.rooms.push(r);
    return { roots, unassignedRooms: rooms.filter((r) => !r.locationId) };
  }

  @CanEdit()
  @Post()
  async create(@Body() dto: LocationDto, @CurrentUser() me: AuthUser) {
    const loc = await this.prisma.location.create({ data: { name: dto.name.trim(), type: dto.type, parentId: dto.parentId ?? null } });
    await this.history.log(me, { entityType: 'Location', entityId: loc.id, entityLabel: loc.name, action: 'CREATE' });
    return loc;
  }

  @CanEdit()
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: LocationDto, @CurrentUser() me: AuthUser) {
    if (dto.parentId && (await this.isDescendant(dto.parentId, id))) {
      throw new BadRequestException('Um local não pode ficar dentro dele mesmo');
    }
    const before = await this.prisma.location.findUniqueOrThrow({ where: { id } });
    const loc = await this.prisma.location.update({
      where: { id },
      data: { name: dto.name.trim(), type: dto.type, parentId: dto.parentId === undefined ? undefined : dto.parentId },
    });
    await this.history.logDiff(me, 'Location', id, loc.name, before, loc, { name: 'Nome', type: 'Tipo' });
    return loc;
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const loc = await this.prisma.location.delete({ where: { id } });
    await this.history.log(me, { entityType: 'Location', entityId: id, entityLabel: loc.name, action: 'DELETE' });
    return { ok: true };
  }

  private async isDescendant(candidateId: string, ancestorId: string): Promise<boolean> {
    let current: string | null = candidateId;
    for (let i = 0; current && i < 50; i++) {
      if (current === ancestorId) return true;
      const loc: { parentId: string | null } | null = await this.prisma.location.findUnique({ where: { id: current }, select: { parentId: true } });
      current = loc?.parentId ?? null;
    }
    return false;
  }
}

// ---------------------------------------------------------------- Salas

@Controller('rooms')
export class RoomsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly structure: StructureService,
    private readonly history: HistoryService,
  ) {}

  @Get()
  async list() {
    const [rooms, paths] = await Promise.all([
      this.prisma.room.findMany({
        orderBy: { name: 'asc' },
        include: { department: true, _count: { select: { devices: true, points: true, racks: true } } },
      }),
      this.structure.locationPaths(),
    ]);
    return rooms.map((r) => ({ ...r, path: this.structure.roomPath(paths, r) }));
  }

  @CanEdit()
  @Post()
  async create(@Body() dto: RoomDto, @CurrentUser() me: AuthUser) {
    const room = await this.prisma.room.create({
      data: { name: dto.name.trim(), locationId: dto.locationId ?? null, departmentId: dto.departmentId ?? null },
    });
    await this.history.log(me, { entityType: 'Room', entityId: room.id, entityLabel: room.name, action: 'CREATE' });
    return room;
  }

  @CanEdit()
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: RoomDto, @CurrentUser() me: AuthUser) {
    const before = await this.prisma.room.findUniqueOrThrow({ where: { id } });
    const room = await this.prisma.room.update({
      where: { id },
      data: { name: dto.name.trim(), locationId: dto.locationId, departmentId: dto.departmentId },
    });
    await this.history.logDiff(me, 'Room', id, room.name, before, room, { name: 'Nome' });
    return room;
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const room = await this.prisma.room.delete({ where: { id } });
    await this.history.log(me, { entityType: 'Room', entityId: id, entityLabel: room.name, action: 'DELETE' });
    return { ok: true };
  }
}

// ---------------------------------------------------------------- Setores

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly prisma: PrismaService, private readonly history: HistoryService) {}

  @Get()
  list() {
    return this.prisma.department.findMany({
      orderBy: { name: 'asc' },
      include: { _count: { select: { devices: true, points: true, rooms: true } } },
    });
  }

  @CanEdit()
  @Post()
  async create(@Body() dto: DepartmentDto, @CurrentUser() me: AuthUser) {
    const name = dto.name.trim();
    if (await this.prisma.department.findUnique({ where: { name } })) throw new ConflictException('Setor já cadastrado');
    const dep = await this.prisma.department.create({ data: { name } });
    await this.history.log(me, { entityType: 'Department', entityId: dep.id, entityLabel: dep.name, action: 'CREATE' });
    return dep;
  }

  @CanEdit()
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: DepartmentDto, @CurrentUser() me: AuthUser) {
    const before = await this.prisma.department.findUniqueOrThrow({ where: { id } });
    const dep = await this.prisma.department.update({ where: { id }, data: { name: dto.name.trim() } });
    await this.history.logDiff(me, 'Department', id, dep.name, before, dep, { name: 'Nome' });
    return dep;
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const dep = await this.prisma.department.delete({ where: { id } });
    await this.history.log(me, { entityType: 'Department', entityId: id, entityLabel: dep.name, action: 'DELETE' });
    return { ok: true };
  }
}
