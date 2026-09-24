import { useState } from 'react';
import { Stack, router, useLocalSearchParams } from 'expo-router';
import { saveEntity, usePoint, useSave } from '@/api/hooks';
import { spacing } from '@/theme';
import { Body, Button, Card, Field, Input, Loading, Screen, SectionTitle, notify } from '@/components/ui';
import { Select } from '@/components/Select';
import { PortPicker } from '@/components/PortPicker';
import { useDepartmentOptions, useDeviceOptions, usePatchPanelOptions, useRoomOptions, useSwitchOptions } from '@/lib/options';

const EMPTY = {
  code: '',
  roomId: null as string | null,
  departmentId: null as string | null,
  notes: '',
  deviceId: null as string | null,
  patchPanelId: null as string | null,
  patchPanelPortNumber: null as number | null,
  switchId: null as string | null,
  switchPortNumber: null as number | null,
  cableLabel: '',
};

export default function PointFormScreen() {
  const { id, switchId, port } = useLocalSearchParams<{ id?: string; switchId?: string; port?: string }>();
  const existing = usePoint(id);
  if (id && existing.isLoading) return <Loading />;

  const p = existing.data;
  const t = p?.trace;
  const initial: typeof EMPTY = p
    ? {
      code: p.code,
      roomId: p.roomId,
      departmentId: p.departmentId,
      notes: p.notes ?? '',
      deviceId: t?.device?.id ?? null,
      patchPanelId: t?.patchPanel?.id ?? null,
      patchPanelPortNumber: t?.patchPanel?.port ?? null,
      switchId: t?.switch?.id ?? null,
      switchPortNumber: t?.switch?.port ?? null,
      cableLabel: t?.cableLabel ?? '',
    }
    : { ...EMPTY, switchId: switchId ?? null, switchPortNumber: port ? Number(port) : null };
  return <PointForm id={id} initial={initial} />;
}

function PointForm({ id, initial }: { id?: string; initial: typeof EMPTY }) {
  const [form, setForm] = useState(initial);
  const set = <K extends keyof typeof EMPTY>(k: K, v: (typeof EMPTY)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const rooms = useRoomOptions();
  const departments = useDepartmentOptions();
  const devices = useDeviceOptions();
  const switches = useSwitchOptions();
  const panels = usePatchPanelOptions();

  const missingPort = (form.switchId && !form.switchPortNumber) || (form.patchPanelId && !form.patchPanelPortNumber);
  const save = useSave(() => saveEntity('points', id, form));
  const submit = () =>
    save.mutate(undefined, {
      onSuccess: (res) => {
        if (id) router.back();
        else router.replace(`/points/${(res as { id: string }).id}`);
      },
      onError: (e) => notify('Verifique os dados', e.message),
    });

  return (
    <Screen>
      <Stack.Screen options={{ title: id ? 'Editar ponto' : 'Novo ponto de rede' }} />

      <Card style={{ gap: spacing.lg }}>
        <Field label="Identificação do ponto *" hint="Use um padrão, ex.: RH-PT-07, LAB01-PT-15">
          <Input value={form.code} onChangeText={(v) => set('code', v.toUpperCase())} placeholder="RH-PT-01" autoCapitalize="characters" autoCorrect={false} />
        </Field>
        <Field label="Sala">
          <Select value={form.roomId} options={rooms} onChange={(v) => set('roomId', v)} placeholder="Selecionar sala" />
        </Field>
        <Field label="Setor">
          <Select value={form.departmentId} options={departments} onChange={(v) => set('departmentId', v)} placeholder="Selecionar setor" />
        </Field>
      </Card>

      <SectionTitle>1. Equipamento ligado na tomada</SectionTitle>
      <Select value={form.deviceId} options={devices} onChange={(v) => set('deviceId', v)} placeholder="Nenhum equipamento" title="Equipamento" icon="desktop-classic" />

      <SectionTitle>2. Patch panel</SectionTitle>
      <Select
        value={form.patchPanelId}
        options={panels}
        onChange={(v) => setForm((f) => ({ ...f, patchPanelId: v, patchPanelPortNumber: null }))}
        placeholder="Sem patch panel (ligação direta)"
        title="Patch panel"
        icon="view-grid-outline"
      />
      <PortPicker kind="patchPanel" ownerId={form.patchPanelId} value={form.patchPanelPortNumber} onChange={(n) => set('patchPanelPortNumber', n)} currentPointId={id} />

      <SectionTitle>3. Switch e porta</SectionTitle>
      <Select
        value={form.switchId}
        options={switches}
        onChange={(v) => setForm((f) => ({ ...f, switchId: v, switchPortNumber: null }))}
        placeholder="Porta do switch não identificada"
        title="Switch"
        icon="switch"
      />
      {form.switchId && <Body muted>Toque na porta do switch:</Body>}
      <PortPicker kind="switch" ownerId={form.switchId} value={form.switchPortNumber} onChange={(n) => set('switchPortNumber', n)} currentPointId={id} />

      <Card style={{ gap: spacing.lg }}>
        <Field label="Identificação do cabo" hint="Etiqueta do cabo, se houver">
          <Input value={form.cableLabel} onChangeText={(v) => set('cableLabel', v)} placeholder="Ex.: CB-0107" autoCapitalize="characters" />
        </Field>
        <Field label="Observações">
          <Input value={form.notes} onChangeText={(v) => set('notes', v)} multiline style={{ minHeight: 70, textAlignVertical: 'top' }} />
        </Field>
      </Card>

      {missingPort && <Body muted>Escolha a porta para concluir.</Body>}
      <Button title="Salvar" icon="content-save-outline" onPress={submit} loading={save.isPending} disabled={!form.code.trim() || !!missingPort} />
    </Screen>
  );
}
