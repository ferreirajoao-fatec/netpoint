import { Body, ConflictException, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Min, MinLength } from 'class-validator';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly, AuthUser, CanEdit, CurrentUser } from '../common/auth';
import { HistoryService } from '../history/history.service';
import { ConnectionsService, connectionInclude } from '../connections/connections.service';
import { StructureService } from '../structure/structure.service';
import { blank, optId, optText } from '../common/format';

export class PointDto {
  @IsString() @MinLength(1, { message: 'Informe a identificação do ponto' }) code: string;
  @IsOptional() @IsUUID() roomId?: string | null;
  @IsOptional() @IsUUID() departmentId?: string | null;
  @IsOptional() @IsString() notes?: string | null;

  // Caminho físico (opcional). null = desconectar, ausente = não alterar.
  @IsOptional() @IsUUID() deviceId?: string | null;
  @IsOptional() @IsUUID() switchId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) switchPortNumber?: number | null;
  @IsOptional() @IsUUID() patchPanelId?: string | null;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) patchPanelPortNumber?: number | null;
  @IsOptional() @IsString() cableLabel?: string | null;
}

@Controller('points')
export class PointsController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    private readonly connections: ConnectionsService,
    private readonly structure: StructureService,
  ) {}

  /** Lista pontos com o caminho resumido. `unmapped=true` → pontos sem porta de switch identificada. */
  @Get()
  async list(@Query('q') q?: string, @Query('unmapped') unmapped?: string, @Query('roomId') roomId?: string) {
    const text = q?.trim();
    const where: Prisma.NetworkPointWhereInput = {
      roomId: roomId || undefined,
      ...(unmapped === 'true' && { OR: [{ connection: { is: null } }, { connection: { is: { switchPortId: null } } }] }),
      ...(text && {
        AND: [{
          OR: [
            { code: { contains: text, mode: 'insensitive' } },
            { room: { name: { contains: text, mode: 'insensitive' } } },
            { department: { name: { contains: text, mode: 'insensitive' } } },
          ],
        }],
      }),
    };
    const [points, paths] = await Promise.all([
      this.prisma.networkPoint.findMany({
        where,
        orderBy: { code: 'asc' },
        take: 500,
        include: { room: true, department: true, connection: { include: connectionInclude } },
      }),
      this.structure.locationPaths(),
    ]);
    return points.map(({ connection, ...p }) => ({
      ...p,
      location: this.structure.roomPath(paths, p.room),
      trace: connection ? this.connections.toTrace(connection, paths) : null,
    }));
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const point = await this.prisma.networkPoint.findUnique({ where: { id }, include: { room: true, department: true } });
    if (!point) throw new NotFoundException('Ponto de rede não encontrado');
    const paths = await this.structure.locationPaths();
    return { ...point, location: this.structure.roomPath(paths, point.room), trace: await this.connections.trace({ pointId: id }) };
  }

  @CanEdit()
  @Post()
  async create(@Body() dto: PointDto, @CurrentUser() me: AuthUser) {
    const code = dto.code.trim().toUpperCase();
    if (await this.prisma.networkPoint.findUnique({ where: { code } })) {
      throw new ConflictException(`O ponto ${code} já está cadastrado`);
    }
    return this.prisma.$transaction(async (tx) => {
      const point = await tx.networkPoint.create({
        data: { code, roomId: dto.roomId || null, departmentId: dto.departmentId || null, notes: blank(dto.notes) },
      });
      await this.history.log(me, { entityType: 'NetworkPoint', entityId: point.id, entityLabel: code, action: 'CREATE' }, tx);
      await this.connections.link(point.id, await this.linkInput(dto, tx), me, tx);
      return point;
    });
  }

  @CanEdit()
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: PointDto, @CurrentUser() me: AuthUser) {
    const code = dto.code.trim().toUpperCase();
    const clash = await this.prisma.networkPoint.findUnique({ where: { code } });
    if (clash && clash.id !== id) throw new ConflictException(`O ponto ${code} já está cadastrado`);
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.networkPoint.findUnique({ where: { id } });
      if (!before) throw new NotFoundException('Ponto de rede não encontrado');
      const point = await tx.networkPoint.update({
        where: { id },
        data: { code, roomId: optId(dto.roomId), departmentId: optId(dto.departmentId), notes: optText(dto.notes) },
      });
      await this.history.logDiff(me, 'NetworkPoint', id, code, before, point, { code: 'Identificação', notes: 'Observações' }, tx);
      await this.connections.link(id, await this.linkInput(dto, tx), me, tx);
      return point;
    });
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    const point = await this.prisma.networkPoint.delete({ where: { id } });
    await this.history.log(me, { entityType: 'NetworkPoint', entityId: id, entityLabel: point.code, action: 'DELETE' });
    return { ok: true };
  }

  private async linkInput(dto: PointDto, tx: Prisma.TransactionClient) {
    return {
      deviceId: dto.deviceId === undefined ? undefined : dto.deviceId || null,
      switchPortId: await this.connections.resolveSwitchPort(dto.switchId, dto.switchPortNumber, tx),
      patchPanelPortId: await this.connections.resolvePatchPort(dto.patchPanelId, dto.patchPanelPortNumber, tx),
      cableLabel: dto.cableLabel === undefined ? undefined : blank(dto.cableLabel),
    };
  }
}
