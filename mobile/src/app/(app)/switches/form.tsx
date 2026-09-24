import { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { saveEntity, useSave, useSwitch } from '@/api/hooks';
import { spacing } from '@/theme';
import { Button, Card, Field, Input, Loading, Screen, Segmented, notify } from '@/components/ui';
import { Select } from '@/components/Select';
import { useRackOptions, useRoomOptions } from '@/lib/options';

const EMPTY = {
  name: '',
  manufacturer: '',
  model: '',
  portCount: '48',
  ipAddress: '',
  macAddress: '',
  roomId: null as string | null,
  rackId: null as string | null,
  notes: '',
};

const COMMON_SIZES = ['8', '16', '24', '48'];

export default function SwitchFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useSwitch(id);
  if (id && existing.isLoading) return <Loading />;

  const s = existing.data;
  const initial: typeof EMPTY = s
    ? {
      name: s.name,
      manufacturer: s.manufacturer ?? '',
      model: s.model ?? '',
      portCount: String(s.portCount),
      ipAddress: s.ipAddress ?? '',
      macAddress: s.macAddress ?? '',
      roomId: s.roomId,
      rackId: s.rackId,
      notes: s.notes ?? '',
    }
    : EMPTY;
  return <SwitchForm id={id} initial={initial} />;
}

function SwitchForm({ id, initial }: { id?: string; initial: typeof EMPTY }) {
  const [form, setForm] = useState(initial);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));
  const rooms = useRoomOptions();
  const racks = useRackOptions();

  const save = useSave(() => saveEntity('switches', id, { ...form, portCount: Number(form.portCount) }));
  const submit = () =>
    save.mutate(undefined, {
      onSuccess: (res) => {
        if (id) router.back();
        else router.replace(`/switches/${(res as { id: string }).id}`);
      },
      onError: (e) => notify('Verifique os dados', e.message),
    });

  const validCount = Number(form.portCount) > 0 && Number.isInteger(Number(form.portCount));

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Editar switch' : 'Novo switch' }} />
      <Card style={{ gap: spacing.lg }}>
        <Field label="Nome do switch *">
          <Input value={form.name} onChangeText={(v) => set('name', v)} placeholder="Ex.: Switch RH 01" />
        </Field>
        <Field label="Fabricante">
          <Input value={form.manufacturer} onChangeText={(v) => set('manufacturer', v)} placeholder="Ex.: Cisco, HPE Aruba…" />
        </Field>
        <Field label="Modelo">
          <Input value={form.model} onChangeText={(v) => set('model', v)} placeholder="Ex.: 2530-48G" />
        </Field>
        <Field label="Quantidade de portas *" hint={id ? 'Reduzir só é possível se as portas removidas estiverem livres.' : undefined}>
          <Segmented value={COMMON_SIZES.includes(form.portCount) ? form.portCount : ''} onChange={(v) => set('portCount', v)} options={COMMON_SIZES.map((s) => ({ value: s, label: s }))} />
          <Input value={form.portCount} onChangeText={(v) => set('portCount', v.replace(/\D/g, ''))} keyboardType="number-pad" placeholder="Outro valor" />
        </Field>
      </Card>
      <Card style={{ gap: spacing.lg }}>
        <Field label="Endereço IP">
          <Input value={form.ipAddress} onChangeText={(v) => set('ipAddress', v)} placeholder="Ex.: 172.16.0.10" keyboardType="numbers-and-punctuation" autoCorrect={false} />
        </Field>
        <Field label="Endereço MAC">
          <Input value={form.macAddress} onChangeText={(v) => set('macAddress', v)} placeholder="Ex.: 00-1A-2B-3C-4D-5E" autoCapitalize="characters" autoCorrect={false} />
        </Field>
        <Field label="Local (sala)">
          <Select value={form.roomId} options={rooms} onChange={(v) => set('roomId', v)} placeholder="Selecionar sala" />
        </Field>
        <Field label="Rack">
          <Select value={form.rackId} options={racks} onChange={(v) => set('rackId', v)} placeholder="Selecionar rack" />
        </Field>
        <Field label="Observações">
          <Input value={form.notes} onChangeText={(v) => set('notes', v)} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
        </Field>
      </Card>
      <Button title="Salvar" icon="content-save-outline" onPress={submit} loading={save.isPending} disabled={!form.name.trim() || !validCount} />
    </Screen>
  );
}
