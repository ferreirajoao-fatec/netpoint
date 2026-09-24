import { Controller, Get, Module } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('dashboard')
class DashboardController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async summary() {
    const p = this.prisma;
    const [devices, switches, points, portsUsed, portsAvailable, portsReserved, portsProblem, unmappedPoints, cables, racks, rooms, recent] =
      await Promise.all([
        p.device.count(),
        p.switch.count(),
        p.networkPoint.count(),
        // Em uso: conectada ou marcada manualmente (ex.: uplink), exceto desativada/com problema
        p.switchPort.count({
          where: { status: { notIn: ['DISABLED', 'FAULTY'] }, OR: [{ connection: { isNot: null } }, { status: 'IN_USE' }] },
        }),
        p.switchPort.count({ where: { status: 'AVAILABLE', connection: { is: null } } }),
        p.switchPort.count({ where: { status: 'RESERVED', connection: { is: null } } }),
        p.switchPort.count({ where: { status: { in: ['DISABLED', 'FAULTY'] } } }),
        // Ponto sem identificação: não se sabe em qual porta de switch ele chega
        p.networkPoint.count({ where: { OR: [{ connection: { is: null } }, { connection: { is: { switchPortId: null } } }] } }),
        // Cabo cadastrado: conexão com ao menos um trecho físico (patch panel ou switch)
        p.connection.count({ where: { OR: [{ switchPortId: { not: null } }, { patchPanelPortId: { not: null } }] } }),
        p.rack.count(),
        p.room.count(),
        p.connectionHistory.findMany({ orderBy: { createdAt: 'desc' }, take: 5 }),
      ]);

    return {
      devices,
      switches,
      points,
      portsUsed,
      portsAvailable,
      portsReserved,
      portsProblem,
      unmappedPoints,
      cables,
      racks,
      rooms,
      recent,
    };
  }
}

@Module({ controllers: [DashboardController] })
export class DashboardModule {}
