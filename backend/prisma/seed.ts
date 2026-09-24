/**
 * Dados de demonstração do NetPoint.
 * Usuários: admin@netpoint.local / admin123 · tecnico@netpoint.local / tecnico123 · consulta@netpoint.local / consulta123
 */
import { DeviceType, PortStatus, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const pad = (n: number) => String(n).padStart(2, '0');

async function main() {
  // Limpa em ordem segura (permite rodar o seed mais de uma vez)
  await prisma.connectionHistory.deleteMany();
  await prisma.connection.deleteMany();
  await prisma.device.deleteMany();
  await prisma.networkPoint.deleteMany();
  await prisma.switch.deleteMany();
  await prisma.patchPanel.deleteMany();
  await prisma.rack.deleteMany();
  await prisma.room.deleteMany();
  await prisma.location.deleteMany();
  await prisma.department.deleteMany();
  await prisma.user.deleteMany();

  // ---------------------------------------------------------------- Usuários
  const users = [
    { name: 'Administrador', email: 'admin@netpoint.local', password: 'admin123', role: 'ADMIN' as const },
    { name: 'Técnico de Plantão', email: 'tecnico@netpoint.local', password: 'tecnico123', role: 'TECHNICIAN' as const },
    { name: 'Consulta', email: 'consulta@netpoint.local', password: 'consulta123', role: 'VIEWER' as const },
  ];
  const [admin] = await Promise.all(
    users.map(async (u) =>
      prisma.user.create({ data: { name: u.name, email: u.email, role: u.role, passwordHash: await bcrypt.hash(u.password, 10) } }),
    ),
  );

  // ---------------------------------------------------------------- Locais
  const campus = await prisma.location.create({ data: { name: 'Campus Central', type: 'BUILDING' } });
  const blocoAdm = await prisma.location.create({ data: { name: 'Bloco Administrativo', type: 'BLOCK', parentId: campus.id } });
  const terreo = await prisma.location.create({ data: { name: 'Térreo', type: 'FLOOR', parentId: blocoAdm.id } });
  const andar1Adm = await prisma.location.create({ data: { name: '1º Andar', type: 'FLOOR', parentId: blocoAdm.id } });
  const blocoAcad = await prisma.location.create({ data: { name: 'Bloco Acadêmico', type: 'BLOCK', parentId: campus.id } });
  const andar1Acad = await prisma.location.create({ data: { name: '1º Andar', type: 'FLOOR', parentId: blocoAcad.id } });

  const dep = async (name: string) => prisma.department.create({ data: { name } });
  const [rh, fin, ti, lab] = await Promise.all([dep('RH'), dep('Financeiro'), dep('TI'), dep('Laboratórios')]);

  const room = (name: string, locationId: string, departmentId: string) => prisma.room.create({ data: { name, locationId, departmentId } });
  const salaRH = await room('Sala RH', terreo.id, rh.id);
  const salaFin = await room('Financeiro', terreo.id, fin.id);
  const cpd = await room('Sala de TI (CPD)', andar1Adm.id, ti.id);
  const lab01 = await room('Laboratório 01', andar1Acad.id, lab.id);

  // ---------------------------------------------------------------- Racks, patch panels e switches
  const rackCpd = await prisma.rack.create({ data: { name: 'Rack CPD 01', roomId: cpd.id, notes: 'Rack 44U principal' } });
  const rackLab = await prisma.rack.create({ data: { name: 'Rack Bloco Acadêmico', roomId: lab01.id } });

  const createPanel = async (name: string, portCount: number, rackId: string) => {
    const panel = await prisma.patchPanel.create({ data: { name, portCount, rackId } });
    await prisma.patchPanelPort.createMany({ data: Array.from({ length: portCount }, (_, i) => ({ patchPanelId: panel.id, number: i + 1 })) });
    return panel;
  };
  const pp01 = await createPanel('Patch Panel 01', 48, rackCpd.id);
  const ppLab = await createPanel('Patch Panel LAB 01', 24, rackLab.id);

  const createSwitch = async (data: { name: string; manufacturer: string; model: string; portCount: number; ipAddress: string; macAddress: string; rackId: string; roomId: string }) => {
    const sw = await prisma.switch.create({ data });
    await prisma.switchPort.createMany({ data: Array.from({ length: data.portCount }, (_, i) => ({ switchId: sw.id, number: i + 1 })) });
    return sw;
  };
  const swRH = await createSwitch({
    name: 'Switch RH 01', manufacturer: 'HPE Aruba', model: '2530-48G', portCount: 48,
    ipAddress: '172.16.0.10', macAddress: '00-1A-2B-3C-4D-10', rackId: rackCpd.id, roomId: cpd.id,
  });
  const swLab = await createSwitch({
    name: 'Switch LAB 01', manufacturer: 'Cisco', model: 'CBS350-24T', portCount: 24,
    ipAddress: '172.16.0.20', macAddress: '00-1A-2B-3C-4D-20', rackId: rackLab.id, roomId: lab01.id,
  });

  const setPort = (switchId: string, number: number, status: PortStatus, notes?: string) =>
    prisma.switchPort.update({ where: { switchId_number: { switchId, number } }, data: { status, notes } });
  await setPort(swRH.id, 48, 'IN_USE', 'Uplink para o core');
  await setPort(swRH.id, 46, 'RESERVED', 'Reservada para o novo ramal do RH');
  await setPort(swRH.id, 47, 'FAULTY', 'Porta sem link — verificar');
  await setPort(swRH.id, 40, 'DISABLED');
  await setPort(swLab.id, 24, 'IN_USE', 'Uplink para o core');

  // ---------------------------------------------------------------- Pontos, equipamentos e conexões
  type Link = {
    code: string; roomId: string; departmentId: string;
    patch?: [string, number]; sw?: [string, number]; cable?: string;
    device?: { name: string; type: DeviceType; user?: string; hostname?: string; ip?: string; mac?: string; asset?: string };
  };

  const connect = async (l: Link) => {
    const point = await prisma.networkPoint.create({ data: { code: l.code, roomId: l.roomId, departmentId: l.departmentId } });
    const device = l.device && await prisma.device.create({
      data: {
        name: l.device.name, type: l.device.type, responsibleUser: l.device.user, departmentId: l.departmentId, roomId: l.roomId,
        hostname: l.device.hostname, ipAddress: l.device.ip, macAddress: l.device.mac, assetTag: l.device.asset,
      },
    });
    const patchPort = l.patch && await prisma.patchPanelPort.findUniqueOrThrow({ where: { patchPanelId_number: { patchPanelId: l.patch[0], number: l.patch[1] } } });
    const swPort = l.sw && await prisma.switchPort.findUniqueOrThrow({ where: { switchId_number: { switchId: l.sw[0], number: l.sw[1] } } });
    await prisma.connection.create({
      data: { networkPointId: point.id, deviceId: device?.id, patchPanelPortId: patchPort?.id, switchPortId: swPort?.id, cableLabel: l.cable },
    });
  };

  // RH — o exemplo principal: PC do Lucas → RH-PT-07 → Patch Panel 01 porta 07 → Switch RH 01 porta 43
  const rhPeople: [number, string, string, DeviceType, number][] = [
    [1, 'PC da Ana', 'Ana', 'COMPUTER', 37],
    [2, 'PC do Bruno', 'Bruno', 'COMPUTER', 38],
    [3, 'Notebook da Carla', 'Carla', 'NOTEBOOK', 39],
    [5, 'Telefone IP RH', 'Recepção RH', 'IP_PHONE', 41],
    [6, 'PC do Diego', 'Diego', 'COMPUTER', 42],
    [7, 'PC do Lucas', 'Lucas', 'COMPUTER', 43],
    [8, 'PC da Mariana', 'Mariana', 'COMPUTER', 44],
    [10, 'Impressora RH', 'Setor RH', 'PRINTER', 45],
  ];
  for (const [pt, name, user, type, port] of rhPeople) {
    const host = name === 'PC do Lucas' ? 'PCRH-LUCAS' : `RH-${type === 'PRINTER' ? 'IMP' : type === 'IP_PHONE' ? 'TEL' : 'PC'}-${user.split(' ')[0].toUpperCase()}`;
    await connect({
      code: `RH-PT-${pad(pt)}`, roomId: salaRH.id, departmentId: rh.id,
      patch: [pp01.id, pt], sw: [swRH.id, port], cable: `CB-01${pad(pt)}`,
      device: {
        name, type, user, hostname: host,
        ip: name === 'PC do Lucas' ? '172.16.20.35' : `172.16.20.${10 + pt}`,
        mac: name === 'PC do Lucas' ? 'A4-B1-C2-D3-E4-F5' : `A4-B1-C2-D3-E5-${pad(pt)}`,
        asset: `PAT-${String(1000 + pt)}`,
      },
    });
  }
  // Ponto sem equipamento e ponto sem mapeamento até o switch
  await connect({ code: 'RH-PT-04', roomId: salaRH.id, departmentId: rh.id, patch: [pp01.id, 4], sw: [swRH.id, 36] });
  await connect({ code: 'RH-PT-09', roomId: salaRH.id, departmentId: rh.id });

  // Financeiro
  for (let i = 1; i <= 4; i++) {
    const people = ['Fernanda', 'Gustavo', 'Helena', 'Igor'];
    await connect({
      code: `FIN-PT-${pad(i)}`, roomId: salaFin.id, departmentId: fin.id,
      patch: [pp01.id, 20 + i], sw: [swRH.id, 20 + i],
      device: { name: `PC ${people[i - 1] === 'Helena' || people[i - 1] === 'Fernanda' ? 'da' : 'do'} ${people[i - 1]}`, type: 'COMPUTER', user: people[i - 1], hostname: `PCFIN-${people[i - 1].toUpperCase()}`, ip: `172.16.21.${10 + i}`, asset: `PAT-20${pad(i)}` },
    });
  }
  await connect({ code: 'FIN-PT-05', roomId: salaFin.id, departmentId: fin.id });

  // Laboratório 01
  for (let i = 1; i <= 15; i++) {
    await connect({
      code: `LAB01-PT-${pad(i)}`, roomId: lab01.id, departmentId: lab.id,
      patch: [ppLab.id, i], sw: [swLab.id, i],
      device: i <= 12
        ? { name: `LAB01-PC${pad(i)}`, type: 'COMPUTER', user: 'Laboratório', hostname: `LAB01-PC${pad(i)}`, ip: `172.16.30.${100 + i}`, asset: `PAT-30${pad(i)}` }
        : i === 13
          ? { name: 'Access Point LAB 01', type: 'ACCESS_POINT', hostname: 'AP-LAB01', ip: '172.16.30.250' }
          : i === 14
            ? { name: 'Câmera Corredor LAB', type: 'CAMERA', hostname: 'CAM-LAB01', ip: '172.16.40.21' }
            : undefined,
    });
  }

  // Servidor no CPD, ligado direto ao switch (sem patch panel)
  await connect({
    code: 'CPD-PT-01', roomId: cpd.id, departmentId: ti.id, sw: [swRH.id, 1],
    device: { name: 'Servidor de Arquivos', type: 'SERVER', user: 'TI', hostname: 'SRV-FILES01', ip: '172.16.0.50', asset: 'PAT-0001' },
  });

  // Histórico de exemplo
  await prisma.connectionHistory.createMany({
    data: [
      {
        userId: admin.id, userName: admin.name, entityType: 'NetworkPoint', entityLabel: 'RH-PT-08 (Switch RH 01 · Porta 44)',
        action: 'CONNECT', field: 'Equipamento', previousValue: 'PC Temporário RH', newValue: 'PC da Mariana',
      },
      { userId: admin.id, userName: admin.name, entityType: 'Import', entityLabel: 'Carga inicial', action: 'IMPORT', description: 'Dados de demonstração carregados' },
    ],
  });

  console.log('Seed concluído. Login: admin@netpoint.local / admin123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
