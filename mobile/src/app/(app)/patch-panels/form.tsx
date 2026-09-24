import { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { saveEntity, usePatchPanel, useSave } from '@/api/hooks';
import { spacing } from '@/theme';
import { Button, Card, Field, Input, Loading, Screen, Segmented, notify } from '@/components/ui';
import { Select } from '@/components/Select';
import { useRackOptions } from '@/lib/options';

const SIZES = ['12', '24', '48'];

export default function PatchPanelFormScreen() {
  const { id, rackId } = useLocalSearchParams<{ id?: string; rackId?: string }>();
  const existing = usePatchPanel(id);
  if (id && existing.isLoading) return <Loading />;
  const p = existing.data;
  const initial: PanelDraft = p
    ? { name: p.name, portCount: String(p.portCount), rackId: p.rackId, notes: p.notes ?? '' }
    : { name: '', portCount: '24', rackId: rackId ?? null, notes: '' };
  return <PatchPanelForm id={id} initial={initial} />;
}

type PanelDraft = { name: string; portCount: string; rackId: string | null; notes: string };

function PatchPanelForm({ id, initial }: { id?: string; initial: PanelDraft }) {
  const racks = useRackOptions();
  const [form, setForm] = useState(initial);

  const save = useSave(() => saveEntity('patch-panels', id, { ...form, portCount: Number(form.portCount) }));
  const submit = () =>
    save.mutate(undefined, {
      onSuccess: (res) => (id ? router.back() : router.replace(`/patch-panels/${(res as { id: string }).id}`)),
      onError: (e) => notify('Verifique os dados', e.message),
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Editar patch panel' : 'Novo patch panel' }} />
      <Card style={{ gap: spacing.lg }}>
        <Field label="Nome *">
          <Input value={form.name} onChangeText={(name) => setForm((f) => ({ ...f, name }))} placeholder="Ex.: Patch Panel 01" />
        </Field>
        <Field label="Quantidade de portas *">
          <Segmented value={SIZES.includes(form.portCount) ? form.portCount : ''} onChange={(portCount) => setForm((f) => ({ ...f, portCount }))} options={SIZES.map((s) => ({ value: s, label: s }))} />
          <Input value={form.portCount} onChangeText={(v) => setForm((f) => ({ ...f, portCount: v.replace(/\D/g, '') }))} keyboardType="number-pad" />
        </Field>
        <Field label="Rack">
          <Select value={form.rackId} options={racks} onChange={(rackId) => setForm((f) => ({ ...f, rackId }))} placeholder="Selecionar rack" />
        </Field>
        <Field label="Observações">
          <Input value={form.notes} onChangeText={(notes) => setForm((f) => ({ ...f, notes }))} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
        </Field>
      </Card>
      <Button title="Salvar" icon="content-save-outline" onPress={submit} loading={save.isPending} disabled={!form.name.trim() || !Number(form.portCount)} />
    </Screen>
  );
}
