import { BadRequestException, Injectable } from '@nestjs/common';
import ExcelJS from 'exceljs';
import { DeviceType } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuthUser } from '../common/auth';
import { HistoryService } from '../history/history.service';
import { ConnectionsService } from '../connections/connections.service';
import { DEVICE_TYPE_LABEL, IPV4_REGEX, MAC_REGEX, normalizeMac } from '../common/format';
import { addSheet } from './excel-export.service';

// Colunas das planilhas-padrão. A ordem pode variar: as colunas são localizadas pelo nome do cabeçalho.
const DEVICE_COLUMNS = ['Equipamento', 'Tipo', 'Usuário', 'Setor', 'Sala', 'Hostname', 'IP', 'MAC', 'Patrimônio', 'Ponto de Rede', 'Observações'];
const POINT_COLUMNS = ['Ponto', 'Sala', 'Setor', 'Patch Panel', 'Porta Patch Panel', 'Switch', 'Porta Switch', 'Equipamento', 'Identificação do Cabo', 'Observações'];

const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

const TYPE_BY_NAME = new Map<string, DeviceType>();
for (const [key, label] of Object.entries(DEVICE_TYPE_LABEL) as [DeviceType, string][]) {
  TYPE_BY_NAME.set(norm(label), key);
  TYPE_BY_NAME.set(norm(key), key);
}
TYPE_BY_NAME.set('pc', 'COMPUTER');
TYPE_BY_NAME.set('ap', 'ACCESS_POINT');
TYPE_BY_NAME.set('camera ip', 'CAMERA');

export interface ImportIssue {
  sheet: string;
  row: number;
  message: string;
}

export interface ImportReport {
  valid: boolean;
  applied: boolean;
  summary: {
    devicesToCreate: number;
    devicesToUpdate: number;
    pointsToCreate: number;
    pointsToUpdate: number;
    departmentsToCreate: string[];
    roomsToCreate: string[];
  };
  errors: ImportIssue[];
  warnings: ImportIssue[];
}

interface DeviceRow {
  row: number;
  name: string;
  type: DeviceType;
  responsibleUser: string | null;
  department: string | null;
  room: string | null;
  hostname: string | null;
  ipAddress: string | null;
  macAddress: string | null;
  assetTag: string | null;
  pointCode: string | null;
  notes: string | null;
  existingId?: string;
}

interface PointRow {
  row: number;
  code: string;
  room: string | null;
  department: string | null;
  patchPanel: string | null;
  patchPanelPort: number | null;
  switchName: string | null;
  switchPort: number | null;
  device: string | null;
  cableLabel: string | null;
  notes: string | null;
  existingId?: string;
}

function cellText(value: ExcelJS.CellValue): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'object') {
    if ('richText' in value) return value.richText.map((r) => r.text).join('').trim() || null;
    if ('text' in value) return String(value.text).trim() || null;
    if ('result' in value) return value.result == null ? null : String(value.result).trim() || null;
    if (value instanceof Date) return value.toISOString();
  }
  return String(value).trim() || null;
}

function readSheet(ws: ExcelJS.Worksheet | undefined, expected: string[]) {
  if (!ws) return null;
  const headerIdx = new Map<string, number>();
  ws.getRow(1).eachCell((cell, col) => {
    const t = cellText(cell.value);
    if (t) headerIdx.set(norm(t), col);
  });
  const rows: { row: number; get: (col: string) => string | null }[] = [];
  ws.eachRow((row, n) => {
    if (n === 1) return;
    const values = expected.map((c) => (headerIdx.has(norm(c)) ? cellText(row.getCell(headerIdx.get(norm(c))!).value) : null));
    if (values.every((v) => !v)) return;
    rows.push({ row: n, get: (col) => (headerIdx.has(norm(col)) ? cellText(row.getCell(headerIdx.get(norm(col))!).value) : null) });
  });
  return { rows, missing: expected.filter((c) => !headerIdx.has(norm(c))) };
}

@Injectable()
export class ExcelImportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly history: HistoryService,
    private readonly connections: ConnectionsService,
  ) {}

  /** Planilha padrão para preenchimento pelo administrador. */
  async template(): Promise<Buffer> {
    const wb = new ExcelJS.Workbook();
    wb.creator = 'NetPoint';
    addSheet(wb, 'Equipamentos', DEVICE_COLUMNS, [
      ['PC do Lucas', 'Computador', 'Lucas', 'RH', 'Sala RH', 'PCRH-LUCAS', '172.16.20.35', 'A4-B1-C2-D3-E4-F5', 'PAT-00123', 'RH-PT-07', null],
    ]);
    addSheet(wb, 'Pontos de Rede', POINT_COLUMNS, [
      ['RH-PT-07', 'Sala RH', 'RH', 'Patch Panel 01', 7, 'Switch RH 01', 43, 'PC do Lucas', 'CB-0107', null],
    ]);
    addSheet(wb, 'Instruções', ['Campo', 'Como preencher'], [
      ['Tipo', `Um destes: ${Object.values(DEVICE_TYPE_LABEL).join(', ')}`],
      ['Setor / Sala', 'Nome do setor e da sala. Se não existirem, serão criados na importação.'],
      ['Patch Panel / Switch', 'Nome exatamente como cadastrado no NetPoint. Precisam existir antes da importação.'],
      ['Porta', 'Número da porta (ex.: 43).'],
      ['Ponto de Rede', 'Identificação do ponto (ex.: RH-PT-07). Pode ser um ponto da aba "Pontos de Rede".'],
      ['Equipamento (aba Pontos)', 'Nome ou hostname do equipamento.'],
      ['Atualização', 'Equipamentos com mesmo patrimônio ou hostname e pontos com mesma identificação são atualizados.'],
    ]);
    return Buffer.from(await wb.xlsx.writeBuffer());
  }

  async import(buffer: Buffer, apply: boolean, user: AuthUser): Promise<ImportReport> {
    const wb = new ExcelJS.Workbook();
    try {
      await wb.xlsx.load(buffer as any);
    } catch {
      throw new BadRequestException('Arquivo inválido. Envie uma planilha .xlsx');
    }

    const errors: ImportIssue[] = [];
    const warnings: ImportIssue[] = [];
    const err = (sheet: string, row: number, message: string) => errors.push({ sheet, row, message });

    const devSheet = readSheet(wb.getWorksheet('Equipamentos'), DEVICE_COLUMNS);
    const ptSheet = readSheet(wb.getWorksheet('Pontos de Rede'), POINT_COLUMNS);
    if (!devSheet && !ptSheet) {
      throw new BadRequestException('A planilha precisa ter a aba "Equipamentos" e/ou "Pontos de Rede". Baixe o modelo padrão.');
    }
    for (const [name, s, required] of [['Equipamentos', devSheet, ['Equipamento', 'Tipo']], ['Pontos de Rede', ptSheet, ['Ponto']]] as const) {
      const missing = s?.missing.filter((c) => (required as readonly string[]).includes(c)) ?? [];
      if (missing.length) err(name, 1, `Coluna obrigatória ausente: ${missing.join(', ')}`);
    }

    // ------------------------------------------------ Dados existentes
    const [departments, rooms, switches, panels, dbDevices, dbPoints] = await Promise.all([
      this.prisma.department.findMany(),
      this.prisma.room.findMany(),
      this.prisma.switch.findMany(),
      this.prisma.patchPanel.findMany(),
      this.prisma.device.findMany({ select: { id: true, name: true, hostname: true, assetTag: true } }),
      this.prisma.networkPoint.findMany({ select: { id: true, code: true } }),
    ]);
    const depByName = new Map(departments.map((d) => [norm(d.name), d]));
    const roomByName = new Map(rooms.map((r) => [norm(r.name), r]));
    const switchByName = new Map(switches.map((s) => [norm(s.name), s]));
    const panelByName = new Map(panels.map((p) => [norm(p.name), p]));
    const pointByCode = new Map(dbPoints.map((p) => [p.code.toUpperCase(), p]));
    const newDeps = new Set<string>();
    const newRooms = new Set<string>();

    const trackRef = (sheet: string, row: number, dep: string | null, room: string | null) => {
      if (dep && !depByName.has(norm(dep))) newDeps.add(dep);
      if (room && !roomByName.has(norm(room))) newRooms.add(room);
      if (room && !roomByName.has(norm(room))) warnings.push({ sheet, row, message: `Sala "${room}" será criada` });
    };

    // ------------------------------------------------ Aba Equipamentos
    const devRows: DeviceRow[] = [];
    const seenHost = new Map<string, number>();
    const seenIp = new Map<string, number>();
    for (const r of devSheet?.rows ?? []) {
      const S = 'Equipamentos';
      const name = r.get('Equipamento');
      const typeText = r.get('Tipo');
      const type = typeText ? TYPE_BY_NAME.get(norm(typeText)) : undefined;
      if (!name) err(S, r.row, 'Nome do equipamento é obrigatório');
      if (!typeText) err(S, r.row, 'Tipo é obrigatório');
      else if (!type) err(S, r.row, `Tipo "${typeText}" inválido`);

      const ip = r.get('IP');
      if (ip && !IPV4_REGEX.test(ip)) err(S, r.row, `IP "${ip}" inválido`);
      const mac = r.get('MAC');
      if (mac && !MAC_REGEX.test(mac)) err(S, r.row, `MAC "${mac}" inválido`);
      const hostname = r.get('Hostname')?.toUpperCase() ?? null;
      if (hostname) {
        if (seenHost.has(hostname)) err(S, r.row, `Hostname ${hostname} repetido (linha ${seenHost.get(hostname)})`);
        seenHost.set(hostname, r.row);
      }
      if (ip) {
        if (seenIp.has(ip)) warnings.push({ sheet: S, row: r.row, message: `IP ${ip} repetido (linha ${seenIp.get(ip)})` });
        seenIp.set(ip, r.row);
      }
      const assetTag = r.get('Patrimônio');
      const existing = dbDevices.find((d) => (assetTag && d.assetTag === assetTag) || (hostname && d.hostname === hostname));
      trackRef(S, r.row, r.get('Setor'), r.get('Sala'));

      if (name && type) {
        devRows.push({
          row: r.row, name, type, responsibleUser: r.get('Usuário'), department: r.get('Setor'), room: r.get('Sala'),
          hostname, ipAddress: ip, macAddress: normalizeMac(mac), assetTag, pointCode: r.get('Ponto de Rede')?.toUpperCase() ?? null,
          notes: r.get('Observações'), existingId: existing?.id,
        });
      }
    }

    // ------------------------------------------------ Aba Pontos de Rede
    const ptRows: PointRow[] = [];
    const seenCode = new Map<string, number>();
    const seenSwitchPort = new Map<string, number>();
    const seenPanelPort = new Map<string, number>();
    const toInt = (S: string, row: number, label: string, v: string | null) => {
      if (!v) return null;
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1) {
        err(S, row, `${label} "${v}" deve ser um número inteiro`);
        return null;
      }
      return n;
    };
    for (const r of ptSheet?.rows ?? []) {
      const S = 'Pontos de Rede';
      const code = r.get('Ponto')?.toUpperCase();
      if (!code) {
        err(S, r.row, 'Identificação do ponto é obrigatória');
        continue;
      }
      if (seenCode.has(code)) err(S, r.row, `Ponto ${code} repetido (linha ${seenCode.get(code)})`);
      seenCode.set(code, r.row);

      const swName = r.get('Switch');
      const swPort = toInt(S, r.row, 'Porta Switch', r.get('Porta Switch'));
      if (swName) {
        const sw = switchByName.get(norm(swName));
        if (!sw) err(S, r.row, `Switch "${swName}" não cadastrado`);
        else if (!swPort) err(S, r.row, `Informe a porta do switch ${sw.name}`);
        else if (swPort > sw.portCount) err(S, r.row, `${sw.name} tem apenas ${sw.portCount} portas`);
        else {
          const k = `${sw.id}:${swPort}`;
          if (seenSwitchPort.has(k)) err(S, r.row, `Porta ${swPort} do ${sw.name} já usada na linha ${seenSwitchPort.get(k)}`);
          seenSwitchPort.set(k, r.row);
        }
      } else if (swPort) err(S, r.row, 'Porta do switch informada sem o switch');

      const ppName = r.get('Patch Panel');
      const ppPort = toInt(S, r.row, 'Porta Patch Panel', r.get('Porta Patch Panel'));
      if (ppName) {
        const pp = panelByName.get(norm(ppName));
        if (!pp) err(S, r.row, `Patch panel "${ppName}" não cadastrado`);
        else if (!ppPort) err(S, r.row, `Informe a porta do ${pp.name}`);
        else if (ppPort > pp.portCount) err(S, r.row, `${pp.name} tem apenas ${pp.portCount} portas`);
        else {
          const k = `${pp.id}:${ppPort}`;
          if (seenPanelPort.has(k)) err(S, r.row, `Porta ${ppPort} do ${pp.name} já usada na linha ${seenPanelPort.get(k)}`);
          seenPanelPort.set(k, r.row);
        }
      }

      trackRef(S, r.row, r.get('Setor'), r.get('Sala'));
      ptRows.push({
        row: r.row, code, room: r.get('Sala'), department: r.get('Setor'), patchPanel: ppName, patchPanelPort: ppPort,
        switchName: swName, switchPort: swPort, device: r.get('Equipamento'), cableLabel: r.get('Identificação do Cabo'),
        notes: r.get('Observações'), existingId: pointByCode.get(code)?.id,
      });
    }

    // ------------------------------------------------ Referências cruzadas
    const knownCodes = new Set([...pointByCode.keys(), ...ptRows.map((p) => p.code)]);
    for (const d of devRows) {
      if (d.pointCode && !knownCodes.has(d.pointCode)) err('Equipamentos', d.row, `Ponto de rede ${d.pointCode} não existe`);
    }
    const deviceRef = (ref: string) => {
      const n = norm(ref);
      const inFile = devRows.filter((d) => norm(d.name) === n || (d.hostname && norm(d.hostname) === n));
      const inDb = dbDevices.filter((d) => norm(d.name) === n || (d.hostname && norm(d.hostname) === n));
      return { inFile, inDb };
    };
    for (const p of ptRows) {
      if (!p.device) continue;
      const { inFile, inDb } = deviceRef(p.device);
      if (!inFile.length && !inDb.length) err('Pontos de Rede', p.row, `Equipamento "${p.device}" não encontrado`);
      else if (inFile.length + inDb.filter((d) => !inFile.some((f) => f.existingId === d.id)).length > 1) {
        err('Pontos de Rede', p.row, `"${p.device}" corresponde a mais de um equipamento; use o hostname`);
      }
    }

    const report: ImportReport = {
      valid: errors.length === 0,
      applied: false,
      summary: {
        devicesToCreate: devRows.filter((d) => !d.existingId).length,
        devicesToUpdate: devRows.filter((d) => d.existingId).length,
        pointsToCreate: ptRows.filter((p) => !p.existingId).length,
        pointsToUpdate: ptRows.filter((p) => p.existingId).length,
        departmentsToCreate: [...newDeps],
        roomsToCreate: [...newRooms],
      },
      errors,
      warnings,
    };
    if (!apply || errors.length) return report;

    // ------------------------------------------------ Gravação (tudo ou nada)
    await this.prisma.$transaction(
      async (tx) => {
        const depId = async (name: string | null) => {
          if (!name) return null;
          const key = norm(name);
          if (!depByName.has(key)) depByName.set(key, await tx.department.create({ data: { name: name.trim() } }));
          return depByName.get(key)!.id;
        };
        const roomId = async (name: string | null, departmentId: string | null) => {
          if (!name) return null;
          const key = norm(name);
          if (!roomByName.has(key)) roomByName.set(key, await tx.room.create({ data: { name: name.trim(), departmentId } }));
          return roomByName.get(key)!.id;
        };

        const pointIds = new Map<string, string>(dbPoints.map((p) => [p.code.toUpperCase(), p.id]));
        for (const p of ptRows) {
          const departmentId = await depId(p.department);
          const data = { code: p.code, departmentId, roomId: await roomId(p.room, departmentId), notes: p.notes };
          const saved = p.existingId
            ? await tx.networkPoint.update({ where: { id: p.existingId }, data })
            : await tx.networkPoint.create({ data });
          pointIds.set(p.code, saved.id);
        }

        const deviceIds = new Map<DeviceRow, string>();
        for (const d of devRows) {
          const departmentId = await depId(d.department);
          const data = {
            name: d.name, type: d.type, responsibleUser: d.responsibleUser, departmentId, roomId: await roomId(d.room, departmentId),
            hostname: d.hostname, ipAddress: d.ipAddress, macAddress: d.macAddress, assetTag: d.assetTag, notes: d.notes,
          };
          const saved = d.existingId ? await tx.device.update({ where: { id: d.existingId }, data }) : await tx.device.create({ data });
          deviceIds.set(d, saved.id);
        }

        for (const p of ptRows) {
          let deviceId: string | undefined;
          if (p.device) {
            const { inFile, inDb } = deviceRef(p.device);
            deviceId = inFile.length ? deviceIds.get(inFile[0]) : inDb[0]?.id;
          }
          const sw = p.switchName ? switchByName.get(norm(p.switchName)) : null;
          const pp = p.patchPanel ? panelByName.get(norm(p.patchPanel)) : null;
          await this.connections.link(pointIds.get(p.code)!, {
            deviceId,
            switchPortId: sw ? await this.connections.resolveSwitchPort(sw.id, p.switchPort, tx) : undefined,
            patchPanelPortId: pp ? await this.connections.resolvePatchPort(pp.id, p.patchPanelPort, tx) : undefined,
            cableLabel: p.cableLabel ?? undefined,
          }, user, tx);
        }
        for (const d of devRows) {
          if (d.pointCode) await this.connections.linkDevice(deviceIds.get(d)!, pointIds.get(d.pointCode)!, user, tx);
        }

        const s = report.summary;
        await this.history.log(user, {
          entityType: 'Import', entityLabel: 'Importação por Excel', action: 'IMPORT',
          description: `${s.devicesToCreate + s.devicesToUpdate} equipamentos e ${s.pointsToCreate + s.pointsToUpdate} pontos importados`,
        }, tx);
      },
      { timeout: 120_000, maxWait: 10_000 },
    );

    report.applied = true;
    return report;
  }
}
