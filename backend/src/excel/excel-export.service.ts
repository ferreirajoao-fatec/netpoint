import { Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { PrismaService } from '../prisma/prisma.service';
import { StructureService } from '../structure/structure.service';
import { DEVICE_TYPE_LABEL, effectivePortStatus, PORT_STATUS_LABEL, switchPortLabel } from '../common/format';
import { portUsage } from '../switches/switches.controller';

type Cell = string | number | null;

const HEADER_FILL = 'FF1E3A8A';

/**
 * Adiciona uma aba formatada: tabela do Excel com cabeçalho destacado,
 * filtros, linhas zebradas, primeira linha congelada e largura automática.
 */
export function addSheet(wb: ExcelJS.Workbook, name: string, headers: string[], rows: Cell[][]) {
  const ws = wb.addWorksheet(name, { views: [{ state: 'frozen', ySplit: 1 }] });
  // Tabela vazia gera arquivo inválido no Excel; usa uma linha indicativa
  const body = rows.length ? rows : [headers.map((_, i) => (i === 0 ? '(sem registros)' : null))];

  ws.addTable({
    name: name.normalize('NFD').replace(/[^A-Za-z0-9]/g, '') || 'Tabela',
    ref: 'A1',
    headerRow: true,
    style: { theme: 'TableStyleMedium2', showRowStripes: true },
    columns: headers.map((h) => ({ name: h, filterButton: true })),
    rows: body.map((r) => r.map((v) => v ?? '')),
  });

  const header = ws.getRow(1);
  header.height = 22;
  header.eachCell((cell) => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    cell.alignment = { vertical: 'middle' };
  });

  headers.forEach((h, i) => {
    const longest = Math.max(h.length, ...body.map((r) => String(r[i] ?? '').length));
    ws.getColumn(i + 1).width = Math.min(Math.max(longest + 3, 10), 60);
  });
  return ws;
}

@Injectable()
export class ExcelExportService {
  constructor(private readonly prisma: PrismaService, private readonly structure: StructureService) {}

  async inventory(): Promise<Buffer> {
    const paths = await this.structure.locationPaths();
    const [devices, points, switches] = await Promise.all([
      this.prisma.device.findMany({
        orderBy: { name: 'asc' },
        include: {
          department: true,
          connection: { include: { networkPoint: true, switchPort: { include: { switch: true } } } },
        },
      }),
      this.prisma.networkPoint.findMany({
        orderBy: { code: 'asc' },
        include: {
          room: true,
          connection: {
            include: { device: true, patchPanelPort: { include: { patchPanel: true } }, switchPort: { include: { switch: true } } },
          },
        },
      }),
      this.prisma.switch.findMany({
        orderBy: { name: 'asc' },
        include: {
          room: true,
          ports: {
            orderBy: { number: 'asc' },
            include: { linkedPort: { include: { switch: true } }, connection: { include: { networkPoint: true, device: { include: { department: true } } } } },
          },
        },
      }),
    ]);

    const wb = new ExcelJS.Workbook();
    wb.creator = 'NetPoint';
    wb.created = new Date();

    addSheet(
      wb,
      'Equipamentos',
      ['Equipamento', 'Tipo', 'Usuário', 'Setor', 'Hostname', 'IP', 'MAC', 'Patrimônio', 'Ponto de Rede', 'Switch', 'Porta'],
      devices.map((d) => [
        d.name,
        DEVICE_TYPE_LABEL[d.type],
        d.responsibleUser,
        d.department?.name ?? null,
        d.hostname,
        d.ipAddress,
        d.macAddress,
        d.assetTag,
        d.connection?.networkPoint.code ?? null,
        d.connection?.switchPort?.switch.name ?? null,
        d.connection?.switchPort?.number ?? null,
      ]),
    );

    addSheet(
      wb,
      'Pontos de Rede',
      ['Ponto', 'Local', 'Sala', 'Patch Panel', 'Porta Patch Panel', 'Switch', 'Porta Switch', 'Equipamento'],
      points.map((p) => {
        const c = p.connection;
        const loc = p.room?.locationId ? paths.get(p.room.locationId) : null;
        return [
          p.code,
          loc ?? null,
          p.room?.name ?? null,
          c?.patchPanelPort?.patchPanel.name ?? null,
          c?.patchPanelPort?.number ?? null,
          c?.switchPort?.switch.name ?? null,
          c?.switchPort?.number ?? null,
          c?.device?.name ?? null,
        ];
      }),
    );

    addSheet(
      wb,
      'Switches',
      ['Switch', 'Modelo', 'IP', 'Local', 'Quantidade de portas', 'Portas utilizadas', 'Portas disponíveis'],
      switches.map((s) => {
        const usage = portUsage(s.ports);
        return [s.name, [s.manufacturer, s.model].filter(Boolean).join(' ') || null, s.ipAddress, this.structure.roomPath(paths, s.room), s.portCount, usage.used, usage.available];
      }),
    );

    addSheet(
      wb,
      'Mapeamento de Portas',
      ['Switch', 'Porta', 'Status', 'Ponto de Rede', 'Uplink', 'Equipamento', 'Usuário', 'Setor', 'IP', 'MAC'],
      switches.flatMap((s) =>
        s.ports.map((port) => {
          const c = port.connection;
          return [
            s.name,
            port.number,
            PORT_STATUS_LABEL[effectivePortStatus(port.status, Boolean(c || port.linkedPort))],
            c?.networkPoint.code ?? null,
            port.linkedPort ? switchPortLabel(port.linkedPort.switch.name, port.linkedPort.number) : null,
            c?.device?.name ?? null,
            c?.device?.responsibleUser ?? null,
            c?.device?.department?.name ?? null,
            c?.device?.ipAddress ?? null,
            c?.device?.macAddress ?? null,
          ];
        }),
      ),
    );

    return Buffer.from(await wb.xlsx.writeBuffer());
  }
}
