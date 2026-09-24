import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Stack, router } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useDevices, type DeviceFilters } from '@/api/hooks';
import { usePermissions } from '@/store/auth';
import { Select } from '@/components/Select';
import { Body, Card, Chip, EmptyState, ErrorView, Fab, Input, ListItem, Loading, Row, Screen, SectionTitle, Segmented } from '@/components/ui';
import { DEVICE_TYPES, deviceTypeIcon, pad2 } from '@/lib/labels';
import { useDepartmentOptions } from '@/lib/options';
import { radius, spacing, useTheme } from '@/theme';

type ConnectionFilter = 'all' | 'connected' | 'disconnected';

export default function DevicesScreen() {
  const { colors } = useTheme();
  const { canEdit } = usePermissions();
  const departments = useDepartmentOptions();
  const [q, setQ] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<DeviceFilters>({});
  const { data, isLoading, error, refetch, isRefetching } = useDevices(q.trim(), filters);

  const activeCount = [filters.type, filters.departmentId, filters.connected].filter((v) => v != null).length;
  const set = <K extends keyof DeviceFilters>(key: K, value: DeviceFilters[K]) => setFilters((f) => ({ ...f, [key]: value }));
  const connection: ConnectionFilter = filters.connected == null ? 'all' : filters.connected ? 'connected' : 'disconnected';

  return (
    <Screen
      onRefresh={refetch}
      refreshing={isRefetching}
      footer={canEdit && <Fab label="Novo" onPress={() => router.push('/devices/form')} />}
    >
      <Stack.Screen options={{ title: 'Equipamentos' }} />
      <Row>
        <View style={{ flex: 1 }}>
          <Input icon="magnify" placeholder="Nome, usuário, hostname, IP, MAC…" value={q} onChangeText={setQ} autoCorrect={false} autoCapitalize="none" />
        </View>
        <Pressable
          onPress={() => setShowFilters((s) => !s)}
          accessibilityRole="button"
          accessibilityLabel={activeCount ? `Filtros (${activeCount} ativos)` : 'Filtros'}
          style={({ pressed }) => ({
            width: 50,
            height: 50,
            borderRadius: radius.md,
            borderWidth: 1,
            alignItems: 'center',
            justifyContent: 'center',
            borderColor: activeCount || showFilters ? colors.primary : colors.border,
            backgroundColor: activeCount ? colors.primarySoft : colors.surface,
            opacity: pressed ? 0.75 : 1,
          })}
        >
          <MaterialCommunityIcons name={activeCount ? 'filter' : 'filter-outline'} size={22} color={activeCount || showFilters ? colors.primary : colors.textMuted} />
          {activeCount > 0 && (
            <View style={{ position: 'absolute', top: -6, right: -6, minWidth: 20, height: 20, borderRadius: 10, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}>
              <Text style={{ color: colors.onPrimary, fontSize: 11, fontWeight: '700' }}>{activeCount}</Text>
            </View>
          )}
        </Pressable>
      </Row>

      {showFilters && (
        <Card style={{ gap: spacing.md }}>
          <SectionTitle
            action={
              activeCount > 0 && (
                <Pressable onPress={() => setFilters({})} hitSlop={8}>
                  <Text style={{ color: colors.danger, fontWeight: '700', fontSize: 14 }}>Limpar filtros</Text>
                </Pressable>
              )
            }
          >
            Tipo
          </SectionTitle>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
            <Chip label="Todos" active={!filters.type} onPress={() => set('type', null)} />
            {DEVICE_TYPES.map((t) => (
              <Chip key={t.value} label={t.label} icon={t.icon} active={filters.type === t.value} onPress={() => set('type', filters.type === t.value ? null : t.value)} />
            ))}
          </ScrollView>

          <SectionTitle>Setor</SectionTitle>
          <Select value={filters.departmentId} options={departments} onChange={(v) => set('departmentId', v)} placeholder="Todos os setores" title="Setor" icon="account-group-outline" />

          <SectionTitle>Conexão</SectionTitle>
          <Segmented
            value={connection}
            onChange={(v) => set('connected', v === 'all' ? null : v === 'connected')}
            options={[
              { value: 'all', label: 'Todos' },
              { value: 'connected', label: 'Conectados' },
              { value: 'disconnected', label: 'Sem conexão' },
            ]}
          />
        </Card>
      )}

      {isLoading && <Loading />}
      {error && <ErrorView error={error} onRetry={refetch} />}
      {!!data?.length && (q || activeCount > 0) && (
        <Body muted size={13}>
          {data.length} {data.length === 1 ? 'equipamento encontrado' : 'equipamentos encontrados'}
        </Body>
      )}
      {data?.length === 0 && (
        <EmptyState
          icon="desktop-classic"
          title="Nenhum equipamento"
          message={q || activeCount ? 'Tente outra busca ou ajuste os filtros.' : 'Cadastre o primeiro equipamento.'}
        />
      )}
      {data?.map((d) => {
        const c = d.connection;
        const where = c ? `${c.networkPoint.code}${c.switchPort ? ` → ${c.switchPort.switch.name} · P${pad2(c.switchPort.number)}` : ''}` : 'Sem conexão';
        return (
          <ListItem
            key={d.id}
            icon={deviceTypeIcon(d.type)}
            iconColor="#7C3AED"
            title={d.name}
            subtitle={[[d.responsibleUser, d.department?.name].filter(Boolean).join(' · '), where].filter(Boolean).join('\n')}
            onPress={() => router.push(`/devices/${d.id}`)}
          />
        );
      })}
    </Screen>
  );
}
