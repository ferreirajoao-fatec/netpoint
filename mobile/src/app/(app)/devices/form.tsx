import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { saveEntity, useDevice, useSave } from '@/api/hooks';
import type { DeviceType } from '@/api/types';
import { radius, spacing, useTheme } from '@/theme';
import { Button, Card, Field, Input, Loading, Screen, SectionTitle, notify } from '@/components/ui';
import { Select } from '@/components/Select';
import { DEVICE_TYPES } from '@/lib/labels';
import { useDepartmentOptions, usePointOptions, useRoomOptions } from '@/lib/options';

const EMPTY = {
  name: '',
  type: 'COMPUTER' as DeviceType,
  responsibleUser: '',
  departmentId: null as string | null,
  roomId: null as string | null,
  hostname: '',
  ipAddress: '',
  macAddress: '',
  assetTag: '',
  notes: '',
  networkPointId: null as string | null,
};

export default function DeviceFormScreen() {
  const { id, pointId } = useLocalSearchParams<{ id?: string; pointId?: string }>();
  const existing = useDevice(id);
  if (id && existing.isLoading) return <Loading />;

  const d = existing.data;
  const initial: typeof EMPTY = d
    ? {
      name: d.name,
      type: d.type,
      responsibleUser: d.responsibleUser ?? '',
      departmentId: d.departmentId,
      roomId: d.roomId,
      hostname: d.hostname ?? '',
      ipAddress: d.ipAddress ?? '',
      macAddress: d.macAddress ?? '',
      assetTag: d.assetTag ?? '',
      notes: d.notes ?? '',
      networkPointId: d.trace.point?.id ?? null,
    }
    : { ...EMPTY, networkPointId: pointId ?? null };
  return <DeviceForm id={id} initial={initial} />;
}

function DeviceForm({ id, initial }: { id?: string; initial: typeof EMPTY }) {
  const { colors } = useTheme();
  const [form, setForm] = useState(initial);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const rooms = useRoomOptions();
  const departments = useDepartmentOptions();
  const points = usePointOptions();

  const save = useSave(() => saveEntity('devices', id, form));
  const submit = () =>
    save.mutate(undefined, {
      onSuccess: (res) => {
        if (id) router.back();
        else router.replace(`/devices/${(res as { id: string }).id}`);
      },
      onError: (e) => notify('Verifique os dados', e.message),
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Editar equipamento' : 'Novo equipamento' }} />

      <Field label="Tipo do equipamento">
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {DEVICE_TYPES.map((t) => {
            const active = form.type === t.value;
            return (
              <Pressable
                key={t.value}
                onPress={() => set('type', t.value)}
                style={{
                  width: '31%',
                  flexGrow: 1,
                  alignItems: 'center',
                  gap: 4,
                  paddingVertical: spacing.md,
                  borderRadius: radius.md,
                  borderWidth: 1.5,
                  borderColor: active ? colors.primary : colors.border,
                  backgroundColor: active ? colors.primarySoft : colors.surface,
                }}
              >
                <MaterialCommunityIcons name={t.icon} size={26} color={active ? colors.primary : colors.textMuted} />
                <Text style={{ color: active ? colors.primary : colors.text, fontSize: 12, fontWeight: '600' }}>{t.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </Field>

      <Card style={{ gap: spacing.lg }}>
        <Field label="Nome do equipamento *">
          <Input value={form.name} onChangeText={(v) => set('name', v)} placeholder="Ex.: PC do Lucas" />
        </Field>
        <Field label="Usuário responsável">
          <Input value={form.responsibleUser} onChangeText={(v) => set('responsibleUser', v)} placeholder="Ex.: Lucas" icon="account-outline" />
        </Field>
        <Field label="Setor">
          <Select value={form.departmentId} options={departments} onChange={(v) => set('departmentId', v)} placeholder="Selecionar setor" />
        </Field>
        <Field label="Sala">
          <Select value={form.roomId} options={rooms} onChange={(v) => set('roomId', v)} placeholder="Selecionar sala" />
        </Field>
      </Card>

      <SectionTitle>Rede</SectionTitle>
      <Card style={{ gap: spacing.lg }}>
        <Field label="Hostname">
          <Input value={form.hostname} onChangeText={(v) => set('hostname', v)} placeholder="Ex.: PCRH-LUCAS" autoCapitalize="characters" autoCorrect={false} />
        </Field>
        <Field label="Endereço IP">
          <Input value={form.ipAddress} onChangeText={(v) => set('ipAddress', v)} placeholder="Ex.: 172.16.20.35" keyboardType="numbers-and-punctuation" autoCorrect={false} />
        </Field>
        <Field label="Endereço MAC">
          <Input value={form.macAddress} onChangeText={(v) => set('macAddress', v)} placeholder="Ex.: A4-B1-C2-D3-E4-F5" autoCapitalize="characters" autoCorrect={false} />
        </Field>
        <Field label="Patrimônio">
          <Input value={form.assetTag} onChangeText={(v) => set('assetTag', v)} placeholder="Ex.: PAT-00123" />
        </Field>
        <Field label="Ponto de rede conectado" hint="Se o ponto já tiver outro equipamento, ele será desconectado de lá.">
          <Select value={form.networkPointId} options={points} onChange={(v) => set('networkPointId', v)} placeholder="Selecionar ponto" title="Ponto de rede" />
        </Field>
      </Card>

      <Field label="Observações">
        <Input value={form.notes} onChangeText={(v) => set('notes', v)} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
      </Field>

      <Button title="Salvar" icon="content-save-outline" onPress={submit} loading={save.isPending} disabled={!form.name.trim()} />
    </Screen>
  );
}
