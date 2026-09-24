import { Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query } from '@nestjs/common';
import { IsEnum, IsOptional, IsString, IsUUID, Matches, MinLength, ValidateIf } from 'class-validator';
import { DeviceType, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AdminOnly, AuthUser, CanEdit, CurrentUser } from '../common/auth';
import { HistoryService } from '../history/history.service';
import { ConnectionsService } from '../connections/connections.service';
import { IPV4_REGEX, MAC_REGEX, normalizeMac, optId, optText } from '../common/format';

const notBlank = (_: unknown, v: unknown) => v !== null && v !== undefined && v !== '';

export class DeviceDto {
  @IsString() @MinLength(1, { message: 'Informe o nome do equipamento' }) name: string;
  @IsEnum(DeviceType, { message: 'Tipo de equipamento inválido' }) type: DeviceType;
  @IsOptional() @IsString() responsibleUser?: string | null;
  @IsOptional() @IsUUID() departmentId?: string | null;
  @IsOptional() @IsUUID() roomId?: string | null;
  @IsOptional() @IsString() hostname?: string | null;
  @ValidateIf(notBlank) @Matches(IPV4_REGEX, { message: 'Endereço IP inválido' }) ipAddress?: string | null;
  @ValidateIf(notBlank) @Matches(MAC_REGEX, { message: 'Endereço MAC inválido (ex.: A4-B1-C2-D3-E4-F5)' }) macAddress?: string | null;
  @IsOptional() @IsString() assetTag?: string | null;
  @IsOptional() @IsString() notes?: string | null;
  /** Ponto de rede onde o equipamento está ligado. null = desconectar. */
  @IsOptional() @IsUUID() networkPointId?: string | null;
}

export const DEVICE_HISTORY_FIELDS = {
  name: 'Nome',
  type: 'Tipo',
  responsibleUser: 'Usuário responsável',
  hostname: 'Hostname',
  ipAddress: 'IP',
  macAddress: 'MAC',
  assetTag: 'Patrimônio',
  notes: 'Observações',
};

export function deviceData(dto: DeviceDto) {
  return {
    name: dto.name.trim(),
    type: dto.type,
    responsibleUser: optText(dto.responsibleUser),
    departmentId: optId(dto.departmentId),
    roomId: optId(dto.roomId),
    hostname: dto.hostname === undefined ? undefined : (optText(dto.hostname)?.toUpperCase() ?? null),
    ipAddress: optText(dto.ipAddress),
    macAddress: dto.macAddress === undefined ? undefined : normalizeMac(optText(dto.macAddress)),
    assetTag: optText(dto.assetTag),
    notes: optText(dto.notes),
  };
}

const listInclude = {
  department: true,
  room: true,
  connection: {
    include: {
      networkPoint: { select: { id: true, code: true } },
      switchPort: { select: { id: true, number: true, switch: { select: { id: true, name: true } } } },
    },
  },
} satisfies Prisma.DeviceInclude;

@Controller('devices')
export class DevicesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    private readonly connections: ConnectionsService,
  ) {}

  @Get()
  list(@Query('q') q?: string, @Query('type') type?: DeviceType, @Query('departmentId') departmentId?: string) {
    const text = q?.trim();
    const where: Prisma.DeviceWhereInput = {
      type: type || undefined,
      departmentId: departmentId || undefined,
      ...(text && {
        OR: [
          { name: { contains: text, mode: 'insensitive' } },
          { responsibleUser: { contains: text, mode: 'insensitive' } },
          { hostname: { contains: text, mode: 'insensitive' } },
          { ipAddress: { contains: text } },
          { macAddress: { contains: normalizeMac(text) ?? text, mode: 'insensitive' } },
          { assetTag: { contains: text, mode: 'insensitive' } },
        ],
      }),
    };
    return this.prisma.device.findMany({ where, include: listInclude, orderBy: { name: 'asc' }, take: 500 });
  }

  @Get(':id')
  async get(@Param('id') id: string) {
    const device = await this.prisma.device.findUnique({ where: { id }, include: { department: true, room: true } });
    if (!device) throw new NotFoundException('Equipamento não encontrado');
    return { ...device, trace: await this.connections.trace({ deviceId: id }) };
  }

  @CanEdit()
  @Post()
  async create(@Body() dto: DeviceDto, @CurrentUser() me: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const device = await tx.device.create({ data: deviceData(dto) });
      await this.history.log(me, { entityType: 'Device', entityId: device.id, entityLabel: device.name, action: 'CREATE' }, tx);
      if (dto.networkPointId) await this.connections.linkDevice(device.id, dto.networkPointId, me, tx);
      return device;
    });
  }

  @CanEdit()
  @Patch(':id')
  async update(@Param('id') id: string, @Body() dto: DeviceDto, @CurrentUser() me: AuthUser) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.device.findUnique({ where: { id }, include: { connection: true } });
      if (!before) throw new NotFoundException('Equipamento não encontrado');
      const device = await tx.device.update({ where: { id }, data: deviceData(dto) });
      await this.history.logDiff(me, 'Device', id, device.name, before, device, DEVICE_HISTORY_FIELDS, tx);
      const currentPoint = before.connection?.networkPointId ?? null;
      if (dto.networkPointId !== undefined && (dto.networkPointId || null) !== currentPoint) {
        await this.connections.linkDevice(id, dto.networkPointId || null, me, tx);
      }
      return device;
    });
  }

  @AdminOnly()
  @Delete(':id')
  async remove(@Param('id') id: string, @CurrentUser() me: AuthUser) {
    await this.connections.linkDevice(id, null, me);
    const device = await this.prisma.device.delete({ where: { id } });
    await this.history.log(me, { entityType: 'Device', entityId: id, entityLabel: device.name, action: 'DELETE' });
    return { ok: true };
  }
}
