import { ReactNode, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useLocations } from '@/api/hooks';
import type { Location } from '@/api/types';
import type { IconName } from '@/lib/labels';
import { radius, spacing, useTheme } from '@/theme';
import { Row } from './ui';

type RoomRef = { id: string; name: string; locationId: string | null } | null | undefined;

interface Group<T> {
  key: string;
  label: string;
  icon: IconName;
  children: Group<T>[];
  items: T[];
  count: number;
}

const byName = (a: string, b: string) => a.localeCompare(b, 'pt-BR', { numeric: true, sensitivity: 'base' });

const LOCATION_ICON: Record<Location['type'], IconName> = {
  BUILDING: 'office-building-outline',
  BLOCK: 'office-building-outline',
  FLOOR: 'layers-outline',
  AREA: 'map-marker-outline',
};

/** Monta a árvore Local (Prédio › Bloco › Andar…) › Sala › itens. */
function buildTree<T>(items: T[], getRoom: (item: T) => RoomRef, locations: Location[]): Group<T>[] {
  const locById = new Map(locations.map((l) => [l.id, l]));
  const root: Group<T> = { key: '', label: '', icon: 'folder-outline', children: [], items: [], count: 0 };

  const child = (parent: Group<T>, key: string, label: string, icon: IconName) => {
    let g = parent.children.find((c) => c.key === key);
    if (!g) {
      g = { key, label, icon, children: [], items: [], count: 0 };
      parent.children.push(g);
    }
    return g;
  };

  for (const item of items) {
    const room = getRoom(item);
    const chain: Location[] = [];
    for (let id = room?.locationId ?? null; id && !chain.some((l) => l.id === id); ) {
      const loc = locById.get(id);
      if (!loc) break;
      chain.unshift(loc);
      id = loc.parentId;
    }
    let node = root;
    node.count++;
    for (const loc of chain) {
      node = child(node, `loc:${loc.id}`, loc.name, LOCATION_ICON[loc.type]);
      node.count++;
    }
    node = room ? child(node, `room:${room.id}`, room.name, 'door') : child(node, 'none', 'Sem local', 'help-circle-outline');
    node.count++;
    node.items.push(item);
  }

  const sort = (g: Group<T>) => {
    g.children.sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : byName(a.label, b.label)));
    g.children.forEach(sort);
  };
  sort(root);
  return root.children;
}

const allKeys = <T,>(groups: Group<T>[]): string[] => groups.flatMap((g) => [g.key, ...allKeys(g.children)]);

/**
 * Lista agrupada por local e sala, com grupos que abrem e fecham.
 * `defaultOpen` define o estado inicial (ex.: aberto durante uma busca).
 */
export function GroupedList<T>({
  items,
  getRoom,
  renderItem,
  noun,
  defaultOpen = false,
}: {
  items: T[];
  getRoom: (item: T) => RoomRef;
  renderItem: (item: T) => ReactNode;
  /** Singular e plural para a contagem, ex.: ['equipamento', 'equipamentos'] */
  noun: [string, string];
  defaultOpen?: boolean;
}) {
  const { colors } = useTheme();
  const { data: locations = [] } = useLocations();
  const tree = useMemo(() => buildTree(items, getRoom, locations), [items, getRoom, locations]);
  // Estado = padrão + grupos que o usuário inverteu
  const [base, setBase] = useState(defaultOpen);
  const [toggled, setToggled] = useState<Set<string>>(new Set());
  const isOpen = (key: string) => (toggled.has(key) ? !base : base);
  const toggle = (key: string) =>
    setToggled((s) => {
      const next = new Set(s);
      if (!next.delete(key)) next.add(key);
      return next;
    });
  const anyClosed = allKeys(tree).some((k) => !isOpen(k));
  const setAll = (open: boolean) => {
    setBase(open);
    setToggled(new Set());
  };

  const renderGroup = (g: Group<T>, depth: number): ReactNode => {
    const open = isOpen(g.key);
    return (
      <View key={g.key} style={{ gap: spacing.sm }}>
        <Pressable
          onPress={() => toggle(g.key)}
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${g.label}, ${g.count} ${g.count === 1 ? noun[0] : noun[1]}`}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: spacing.sm,
            paddingVertical: depth === 0 ? 14 : 11,
            paddingHorizontal: spacing.md,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: depth === 0 ? colors.primary + '55' : colors.border,
            backgroundColor: depth === 0 ? colors.primarySoft : colors.surfaceAlt,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <MaterialCommunityIcons name={open ? 'chevron-down' : 'chevron-right'} size={22} color={depth === 0 ? colors.primary : colors.textMuted} />
          <MaterialCommunityIcons name={g.icon} size={20} color={depth === 0 ? colors.primary : colors.text} />
          <Text style={{ flex: 1, color: colors.text, fontSize: depth === 0 ? 17 : 15, fontWeight: '700' }} numberOfLines={1}>
            {g.label}
          </Text>
          <View style={{ minWidth: 30, paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.pill, backgroundColor: colors.surface, alignItems: 'center' }}>
            <Text style={{ color: colors.textMuted, fontSize: 13, fontWeight: '700' }}>{g.count}</Text>
          </View>
        </Pressable>
        {open && (
          <View style={{ gap: spacing.sm, marginLeft: spacing.md, paddingLeft: spacing.sm, borderLeftWidth: 2, borderLeftColor: colors.border }}>
            {g.children.map((c) => renderGroup(c, depth + 1))}
            {g.items.map(renderItem)}
          </View>
        )}
      </View>
    );
  };

  if (!items.length) return null;
  return (
    <View style={{ gap: spacing.sm }}>
      <Row style={{ justifyContent: 'space-between' }}>
        <Text style={{ color: colors.textMuted, fontSize: 13 }}>
          {items.length} {items.length === 1 ? noun[0] : noun[1]}
        </Text>
        <Pressable onPress={() => setAll(anyClosed)} hitSlop={8} accessibilityRole="button">
          <Row gap={4}>
            <MaterialCommunityIcons name={anyClosed ? 'unfold-more-horizontal' : 'unfold-less-horizontal'} size={18} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 14 }}>{anyClosed ? 'Expandir tudo' : 'Recolher tudo'}</Text>
          </Row>
        </Pressable>
      </Row>
      {tree.map((g) => renderGroup(g, 0))}
    </View>
  );
}
