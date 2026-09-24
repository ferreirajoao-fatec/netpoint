import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export const PATH_SEPARATOR = ' › ';

/** Utilitários para montar o caminho legível de um local (Prédio › Bloco › Andar). */
@Injectable()
export class StructureService {
  constructor(private readonly prisma: PrismaService) {}

  /** Mapa locationId → caminho completo. A tabela de locais é pequena, então carregamos inteira. */
  async locationPaths(): Promise<Map<string, string>> {
    const all = await this.prisma.location.findMany({ select: { id: true, name: true, parentId: true } });
    const byId = new Map(all.map((l) => [l.id, l]));
    const cache = new Map<string, string>();

    const resolve = (id: string, depth = 0): string => {
      if (cache.has(id)) return cache.get(id)!;
      const loc = byId.get(id);
      if (!loc) return '';
      const parent = loc.parentId && depth < 20 ? resolve(loc.parentId, depth + 1) : '';
      const path = parent ? `${parent}${PATH_SEPARATOR}${loc.name}` : loc.name;
      cache.set(id, path);
      return path;
    };

    for (const l of all) resolve(l.id);
    return cache;
  }

  /** Caminho completo de uma sala, incluindo a própria sala: "Bloco Adm › Térreo › Sala RH". */
  roomPath(paths: Map<string, string>, room?: { name: string; locationId: string | null } | null): string | null {
    if (!room) return null;
    const loc = room.locationId ? paths.get(room.locationId) : null;
    return loc ? `${loc}${PATH_SEPARATOR}${room.name}` : room.name;
  }
}
