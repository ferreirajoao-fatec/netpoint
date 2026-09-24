import { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { saveEntity, useRack, useSave } from '@/api/hooks';
import { spacing } from '@/theme';
import { Button, Card, Field, Input, Loading, Screen, notify } from '@/components/ui';
import { Select } from '@/components/Select';
import { useRoomOptions } from '@/lib/options';

export default function RackFormScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const existing = useRack(id);
  if (id && existing.isLoading) return <Loading />;
  const r = existing.data;
  return <RackForm id={id} initial={{ name: r?.name ?? '', roomId: r?.roomId ?? null, notes: r?.notes ?? '' }} />;
}

type RackDraft = { name: string; roomId: string | null; notes: string };

function RackForm({ id, initial }: { id?: string; initial: RackDraft }) {
  const rooms = useRoomOptions();
  const [form, setForm] = useState(initial);

  const save = useSave(() => saveEntity('racks', id, form));
  const submit = () =>
    save.mutate(undefined, {
      onSuccess: (res) => (id ? router.back() : router.replace(`/racks/${(res as { id: string }).id}`)),
      onError: (e) => notify('Verifique os dados', e.message),
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Editar rack' : 'Novo rack' }} />
      <Card style={{ gap: spacing.lg }}>
        <Field label="Nome do rack *">
          <Input value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="Ex.: Rack CPD 01" />
        </Field>
        <Field label="Sala">
          <Select value={form.roomId} options={rooms} onChange={(roomId) => setForm((f) => ({ ...f, roomId }))} placeholder="Selecionar sala" />
        </Field>
        <Field label="Observações">
          <Input value={form.notes} onChangeText={(notes) => setForm((f) => ({ ...f, notes }))} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
        </Field>
      </Card>
      <Button title="Salvar" icon="content-save-outline" onPress={submit} loading={save.isPending} disabled={!form.name.trim()} />
    </Screen>
  );
}
