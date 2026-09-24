import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDashboard } from '@/api/hooks';
import { useAuth, usePermissions } from '@/store/auth';
import { radius, spacing, useTheme } from '@/theme';
import { Body, Card, ErrorView, IconBadge, Input, Row, Screen, SectionTitle, notify } from '@/components/ui';
import { HistoryItem } from '@/components/HistoryItem';
import { exportInventory } from '@/lib/download';
import type { IconName } from '@/lib/labels';

export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuth((s) => s.user);
  const { canEdit, isAdmin } = usePermissions();
  const { data, isLoading, error, refetch, isRefetching } = useDashboard();
  const [q, setQ] = useState('');
  const [exporting, setExporting] = useState(false);

  const search = () => q.trim() && router.push({ pathname: '/search', params: { q: q.trim() } });

  const doExport = async () => {
    setExporting(true);
    try {
      await exportInventory();
    } catch (e) {
      notify('Não foi possível exportar', e instanceof Error ? e.message : String(e));
    } finally {
      setExporting(false);
    }
  };

  const stats: { label: string; value?: number; icon: IconName; color: string; href: string }[] = [
    { label: 'Equipamentos', value: data?.devices, icon: 'desktop-classic', color: '#7C3AED', href: '/devices' },
    { label: 'Switches', value: data?.switches, icon: 'switch', color: '#16A34A', href: '/switches' },
    { label: 'Pontos de rede', value: data?.points, icon: 'ethernet', color: '#0891B2', href: '/points' },
    { label: 'Cabos cadastrados', value: data?.cables, icon: 'cable-data', color: '#EA580C', href: '/points' },
    { label: 'Portas em uso', value: data?.portsUsed, icon: 'lan-connect', color: '#15803D', href: '/switches' },
    { label: 'Portas disponíveis', value: data?.portsAvailable, icon: 'lan-pending', color: '#64748B', href: '/switches' },
    { label: 'Pontos sem identificação', value: data?.unmappedPoints, icon: 'help-network-outline', color: '#DC2626', href: '/points?unmapped=1' },
  ];

  const shortcuts: { label: string; icon: IconName; onPress: () => void; show: boolean }[] = [
    { label: 'Cadastrar equipamento', icon: 'desktop-classic', onPress: () => router.push('/devices/form'), show: canEdit },
    { label: 'Cadastrar ponto de rede', icon: 'ethernet', onPress: () => router.push('/points/form'), show: canEdit },
    { label: 'Cadastrar switch', icon: 'switch', onPress: () => router.push('/switches/form'), show: canEdit },
    { label: 'Consultar conexão', icon: 'transit-connection-variant', onPress: () => router.push('/search'), show: true },
    { label: exporting ? 'Gerando planilha…' : 'Exportar dados', icon: 'microsoft-excel', onPress: doExport, show: isAdmin },
  ];

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching} padded={false}>
      {/* Cabeçalho com busca — o fluxo principal do técnico começa aqui */}
      <View style={{ backgroundColor: colors.primary, paddingTop: insets.top + spacing.lg, padding: spacing.lg, paddingBottom: spacing.xl, gap: spacing.md, borderBottomLeftRadius: 28, borderBottomRightRadius: 28 }}>
        <Row style={{ justifyContent: 'space-between' }}>
          <View>
            <Text style={{ color: '#DBE7FF', fontSize: 15 }}>Olá, {user?.name?.split(' ')[0]} 👋</Text>
            <Text style={{ color: '#fff', fontSize: 26, fontWeight: '800' }}>NetPoint</Text>
          </View>
          <Pressable onPress={() => router.push('/qr')} accessibilityLabel="Ler QR Code" style={{ backgroundColor: '#ffffff22', borderRadius: 24, padding: 10 }}>
            <MaterialCommunityIcons name="qrcode-scan" size={26} color="#fff" />
          </Pressable>
        </Row>
        <Text style={{ color: '#DBE7FF', fontSize: 15 }}>Onde está conectado?</Text>
        <Input
          icon="magnify"
          placeholder="Funcionário, PC, hostname, IP, ponto, porta…"
          value={q}
          onChangeText={setQ}
          onSubmitEditing={search}
          returnKeyType="search"
          autoCorrect={false}
        />
      </View>

      <View style={{ padding: spacing.lg, gap: spacing.md }}>
        {error ? (
          <ErrorView error={error} onRetry={refetch} />
        ) : (
          <>
            <SectionTitle>Resumo da infraestrutura</SectionTitle>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md }}>
              {stats.map((s) => (
                <Card key={s.label} onPress={() => router.push(s.href as never)} style={{ width: '47.5%', flexGrow: 1, gap: spacing.sm, padding: spacing.md }}>
                  <IconBadge name={s.icon} color={s.color} size={40} />
                  <Text style={{ color: colors.text, fontSize: 28, fontWeight: '800' }}>{isLoading ? '…' : (s.value ?? 0)}</Text>
                  <Text style={{ color: colors.textMuted, fontSize: 14 }}>{s.label}</Text>
                </Card>
              ))}
            </View>

            <SectionTitle>Atalhos</SectionTitle>
            <View style={{ gap: spacing.sm }}>
              {shortcuts
                .filter((s) => s.show)
                .map((s) => (
                  <Pressable
                    key={s.label}
                    onPress={s.onPress}
                    style={({ pressed }) => ({
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: spacing.md,
                      backgroundColor: colors.surface,
                      borderRadius: radius.lg,
                      padding: spacing.lg,
                      opacity: pressed ? 0.75 : 1,
                      borderWidth: 1,
                      borderColor: colors.border,
                    })}
                  >
                    <IconBadge name={s.icon} size={40} />
                    <Body bold size={16}>
                      {s.label}
                    </Body>
                    <View style={{ flex: 1 }} />
                    <MaterialCommunityIcons name="chevron-right" size={22} color={colors.textMuted} />
                  </Pressable>
                ))}
            </View>

            {!!data?.recent.length && (
              <>
                <SectionTitle action={<Text onPress={() => router.push('/history')} style={{ color: colors.primary, fontWeight: '700' }}>Ver tudo</Text>}>
                  Últimas alterações
                </SectionTitle>
                {data.recent.slice(0, 3).map((h) => (
                  <HistoryItem key={h.id} entry={h} />
                ))}
              </>
            )}
          </>
        )}
      </View>
    </Screen>
  );
}
