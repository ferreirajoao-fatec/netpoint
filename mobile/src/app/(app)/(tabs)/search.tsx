import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSearch } from '@/api/hooks';
import type { SearchResult } from '@/api/types';
import { spacing, useTheme } from '@/theme';
import { Body, Card, EmptyState, ErrorView, IconBadge, Input, ListItem, Row, Screen, SectionTitle } from '@/components/ui';
import { TraceFlow } from '@/components/TraceFlow';
import { deviceTypeIcon } from '@/lib/labels';

const EXAMPLES = ['Lucas', 'PCRH-LUCAS', '172.16.20.35', 'RH-PT-07', '43', 'Switch RH 01'];

function useDebounced<T>(value: T, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function SearchScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{ q?: string }>();
  // Uma nova busca vinda da tela inicial (?q=) substitui o texto digitado
  const [typed, setTyped] = useState({ from: params.q, value: params.q ?? '' });
  const q = typed.from === params.q ? typed.value : (params.q ?? '');
  const setQ = (value: string) => setTyped({ from: params.q, value });
  const debounced = useDebounced(q);
  const { data, isFetching, error, refetch } = useSearch(debounced);

  const results = debounced.trim() ? (data?.results ?? []) : [];

  return (
    <Screen>
      <Input
        icon="magnify"
        placeholder="Nome, PC, hostname, IP, MAC, patrimônio, ponto, switch, porta…"
        value={q}
        onChangeText={setQ}
        autoFocus={!params.q}
        autoCorrect={false}
        autoCapitalize="none"
        returnKeyType="search"
        clearButtonMode="while-editing"
      />

      {!q.trim() && (
        <>
          <Body muted>Digite qualquer informação que você tenha. Exemplos:</Body>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {EXAMPLES.map((ex) => (
              <Pressable
                key={ex}
                onPress={() => setQ(ex)}
                style={{ backgroundColor: colors.primarySoft, borderRadius: 999, paddingHorizontal: 14, paddingVertical: 8 }}
              >
                <Text style={{ color: colors.primary, fontWeight: '700' }}>{ex}</Text>
              </Pressable>
            ))}
          </View>
        </>
      )}

      {isFetching && (
        <Row>
          <ActivityIndicator color={colors.primary} />
          <Body muted>Procurando…</Body>
        </Row>
      )}
      {error && <ErrorView error={error} onRetry={refetch} />}

      {!!debounced.trim() && !isFetching && !error && results.length === 0 && (
        <EmptyState icon="magnify-close" title="Nada encontrado" message={`Nenhum resultado para "${debounced}"`} />
      )}

      {results.length > 0 && <SectionTitle>{`${results.length} resultado${results.length > 1 ? 's' : ''}`}</SectionTitle>}
      {results.map((r) => (
        <ResultCard key={`${r.kind}-${r.id}`} result={r} />
      ))}
    </Screen>
  );
}

function ResultCard({ result: r }: { result: SearchResult }) {
  if (r.kind === 'switch') {
    return <ListItem icon="switch" iconColor="#16A34A" title={r.title} subtitle={r.subtitle} onPress={() => router.push(`/switches/${r.id}`)} />;
  }
  if (r.kind === 'rack') {
    return <ListItem icon="server" iconColor="#0F766E" title={r.title} subtitle={r.subtitle} onPress={() => router.push(`/racks/${r.id}`)} />;
  }

  const icon = r.kind === 'device' && r.trace?.device ? deviceTypeIcon(r.trace.device.type) : r.kind === 'port' ? 'switch' : 'ethernet';
  const open = () => {
    if (r.kind === 'device') router.push({ pathname: '/trace', params: { deviceId: r.id } });
    else if (r.kind === 'point') router.push({ pathname: '/trace', params: { pointId: r.id } });
    else router.push(`/switches/${r.switchId}?port=${r.portNumber}`);
  };

  return (
    <Card onPress={open} style={{ gap: spacing.md }}>
      <Row gap={spacing.md}>
        <IconBadge name={icon} size={40} />
        <View style={{ flex: 1 }}>
          <Body bold size={17}>
            {r.title}
          </Body>
          {r.subtitle && <Body muted>{r.subtitle}</Body>}
        </View>
      </Row>
      {r.trace && <TraceFlow trace={r.trace} compact />}
    </Card>
  );
}
