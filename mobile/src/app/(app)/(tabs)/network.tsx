import { Text, View } from 'react-native';
import { router } from 'expo-router';
import { useDashboard } from '@/api/hooks';
import { spacing, useTheme } from '@/theme';
import { Body, Card, IconBadge, Screen, SectionTitle } from '@/components/ui';
import type { IconName } from '@/lib/labels';

interface Tile {
  title: string;
  description: string;
  icon: IconName;
  color: string;
  href: string;
  count?: number;
}

export default function NetworkScreen() {
  const { colors } = useTheme();
  const { data, refetch, isRefetching } = useDashboard();

  const tiles: Tile[] = [
    { title: 'Equipamentos', description: 'PCs, impressoras, APs, câmeras…', icon: 'desktop-classic', color: '#7C3AED', href: '/devices', count: data?.devices },
    { title: 'Switches', description: 'Portas e o que está ligado em cada uma', icon: 'switch', color: '#16A34A', href: '/switches', count: data?.switches },
    { title: 'Pontos de rede', description: 'Tomadas de rede identificadas', icon: 'ethernet', color: '#0891B2', href: '/points', count: data?.points },
    { title: 'Racks', description: 'Switches e patch panels por rack', icon: 'server', color: '#0F766E', href: '/racks', count: data?.racks },
    { title: 'Salas e locais', description: 'Prédio › Bloco › Andar › Sala', icon: 'office-building-marker-outline', color: '#2563EB', href: '/locations', count: data?.rooms },
    { title: 'Histórico', description: 'Quem alterou o quê e quando', icon: 'history', color: '#9333EA', href: '/history' },
  ];

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <SectionTitle>Infraestrutura</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
        {tiles.map((t) => (
          <Card key={t.title} onPress={() => router.push(t.href as never)} style={{ width: '47.5%', flexGrow: 1, gap: spacing.sm, minHeight: 150 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <IconBadge name={t.icon} color={t.color} size={48} />
              {t.count !== undefined && <Text style={{ color: colors.text, fontSize: 24, fontWeight: '800' }}>{t.count}</Text>}
            </View>
            <Body bold size={17}>
              {t.title}
            </Body>
            <Body muted size={13}>
              {t.description}
            </Body>
          </Card>
        ))}
      </View>
    </Screen>
  );
}
