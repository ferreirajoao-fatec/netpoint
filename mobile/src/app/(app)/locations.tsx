import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Stack } from 'expo-router';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { deleteEntity, saveEntity, useDepartments, useLocations, useLocationTree, useSave } from '@/api/hooks';
import type { LocationNode, LocationType, Room } from '@/api/types';
import { usePermissions } from '@/store/auth';
import { radius, spacing, useTheme } from '@/theme';
import { Body, Button, Card, ErrorView, Field, Input, Loading, Row, Screen, SectionTitle, Segmented, confirm, notify } from '@/components/ui';
import { Select } from '@/components/Select';
import { LOCATION_TYPES } from '@/lib/labels';
import { useDepartmentOptions } from '@/lib/options';

type Kind = 'locations' | 'rooms' | 'departments';
interface Draft {
  kind: Kind;
  id?: string;
  name: string;
  type: LocationType;
  parentId: string | null;
  locationId: string | null;
  departmentId: string | null;
}

const blankDraft = (kind: Kind, extra: Partial<Draft> = {}): Draft => ({
  kind,
  name: '',
  type: 'BLOCK',
  parentId: null,
  locationId: null,
  departmentId: null,
  ...extra,
});

/** Organização física: Prédio › Bloco › Andar › Sala, além dos setores. */
export default function LocationsScreen() {
  const { canEdit, canDelete } = usePermissions();
  const tree = useLocationTree();
  const locations = useLocations();
  const departments = useDepartments();
  const departmentOptions = useDepartmentOptions();
  const [draft, setDraft] = useState<Draft | null>(null);

  const locationOptions = (locations.data ?? [])
    .filter((l) => l.id !== draft?.id)
    .map((l) => ({ value: l.id, label: l.name, subtitle: l.path, icon: LOCATION_TYPES.find((t) => t.value === l.type)?.icon }));

  const save = useSave((d: Draft) => {
    const body =
      d.kind === 'locations'
        ? { name: d.name, type: d.type, parentId: d.parentId }
        : d.kind === 'rooms'
          ? { name: d.name, locationId: d.locationId, departmentId: d.departmentId }
          : { name: d.name };
    return saveEntity(d.kind, d.id, body);
  });
  const remove = useSave((d: Draft) => deleteEntity(d.kind, d.id!));

  const submit = () =>
    draft && save.mutate(draft, { onSuccess: () => setDraft(null), onError: (e) => notify('Verifique os dados', e.message) });
  const onDelete = () =>
    draft?.id &&
    confirm('Excluir', `Excluir "${draft.name}"?${draft.kind === 'locations' ? ' Os locais dentro dele também serão excluídos.' : ''}`, () =>
      remove.mutate(draft, { onSuccess: () => setDraft(null), onError: (e) => notify('Erro', e.message) }),
    );

  const editLocation = (n: LocationNode) => canEdit && setDraft(blankDraft('locations', { id: n.id, name: n.name, type: n.type, parentId: n.parentId }));
  const editRoom = (r: Room) => canEdit && setDraft(blankDraft('rooms', { id: r.id, name: r.name, locationId: r.locationId, departmentId: r.departmentId }));

  if (tree.isLoading) return <Loading />;
  if (tree.error) return <ErrorView error={tree.error} onRetry={tree.refetch} />;

  return (
    <Screen onRefresh={tree.refetch} refreshing={tree.isRefetching}>
      <Stack.Screen options={{ title: 'Salas e locais' }} />

      {canEdit && !draft && (
        <Row>
          <Button title="Local" icon="plus" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft(blankDraft('locations'))} />
          <Button title="Sala" icon="plus" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft(blankDraft('rooms'))} />
          <Button title="Setor" icon="plus" variant="secondary" style={{ flex: 1 }} onPress={() => setDraft(blankDraft('departments'))} />
        </Row>
      )}

      {draft && (
        <Card style={{ gap: spacing.lg }}>
          <Body bold size={17}>
            {`${draft.id ? 'Editar' : 'Novo'} ${draft.kind === 'locations' ? 'local' : draft.kind === 'rooms' ? 'sala' : 'setor'}`}
          </Body>
          <Field label="Nome *">
            <Input
              value={draft.name}
              onChangeText={(name) => setDraft({ ...draft, name })}
              placeholder={draft.kind === 'locations' ? 'Ex.: Bloco Administrativo' : draft.kind === 'rooms' ? 'Ex.: Sala RH' : 'Ex.: RH'}
              autoFocus
            />
          </Field>
          {draft.kind === 'locations' && (
            <>
              <Field label="Tipo">
                <Segmented value={draft.type} onChange={(type) => setDraft({ ...draft, type })} options={LOCATION_TYPES.map((t) => ({ value: t.value, label: t.label }))} />
              </Field>
              <Field label="Fica dentro de" hint="Ex.: um andar fica dentro de um bloco">
                <Select value={draft.parentId} options={locationOptions} onChange={(parentId) => setDraft({ ...draft, parentId })} placeholder="Nível principal" />
              </Field>
            </>
          )}
          {draft.kind === 'rooms' && (
            <>
              <Field label="Local (andar/bloco)">
                <Select value={draft.locationId} options={locationOptions} onChange={(locationId) => setDraft({ ...draft, locationId })} placeholder="Selecionar local" />
              </Field>
              <Field label="Setor">
                <Select value={draft.departmentId} options={departmentOptions} onChange={(departmentId) => setDraft({ ...draft, departmentId })} placeholder="Selecionar setor" />
              </Field>
            </>
          )}
          <Row>
            <Button title="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={() => setDraft(null)} />
            <Button title="Salvar" icon="content-save-outline" style={{ flex: 1 }} onPress={submit} loading={save.isPending} disabled={!draft.name.trim()} />
          </Row>
          {draft.id && canDelete && <Button title="Excluir" icon="delete-outline" variant="danger" onPress={onDelete} loading={remove.isPending} />}
        </Card>
      )}

      <SectionTitle>Estrutura</SectionTitle>
      {tree.data?.roots.length === 0 && <Body muted>Nenhum local cadastrado. Comece pelo prédio ou bloco.</Body>}
      {tree.data?.roots.map((n) => (
        <Card key={n.id} style={{ padding: spacing.md }}>
          <TreeNode node={n} depth={0} onEditLocation={editLocation} onEditRoom={editRoom} />
        </Card>
      ))}
      {!!tree.data?.unassignedRooms.length && (
        <Card style={{ padding: spacing.md }}>
          <Body muted bold>
            Salas sem local definido
          </Body>
          {tree.data.unassignedRooms.map((r) => (
            <RoomRow key={r.id} room={r} depth={0} onPress={() => editRoom(r)} />
          ))}
        </Card>
      )}

      <SectionTitle>Setores</SectionTitle>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {departments.data?.map((d) => (
          <DepartmentChip key={d.id} name={d.name} count={d._count?.devices ?? 0} onPress={() => canEdit && setDraft(blankDraft('departments', { id: d.id, name: d.name }))} />
        ))}
      </View>
    </Screen>
  );
}

function TreeNode({ node, depth, onEditLocation, onEditRoom }: { node: LocationNode; depth: number; onEditLocation: (n: LocationNode) => void; onEditRoom: (r: Room) => void }) {
  const { colors } = useTheme();
  const type = LOCATION_TYPES.find((t) => t.value === node.type);
  return (
    <View>
      <Pressable onPress={() => onEditLocation(node)} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, paddingLeft: depth * 18 }}>
        {depth > 0 && <MaterialCommunityIcons name="subdirectory-arrow-right" size={18} color={colors.textMuted} />}
        <MaterialCommunityIcons name={type?.icon ?? 'map-marker-outline'} size={22} color={colors.primary} />
        <View style={{ flex: 1 }}>
          <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16 }}>{node.name}</Text>
          <Text style={{ color: colors.textMuted, fontSize: 12 }}>{type?.label}</Text>
        </View>
      </Pressable>
      {node.children.map((c) => (
        <TreeNode key={c.id} node={c} depth={depth + 1} onEditLocation={onEditLocation} onEditRoom={onEditRoom} />
      ))}
      {node.rooms.map((r) => (
        <RoomRow key={r.id} room={r} depth={depth + 1} onPress={() => onEditRoom(r)} />
      ))}
    </View>
  );
}

function RoomRow({ room, depth, onPress }: { room: Room; depth: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingVertical: 8, paddingLeft: depth * 18 }}>
      <MaterialCommunityIcons name="subdirectory-arrow-right" size={18} color={colors.textMuted} />
      <MaterialCommunityIcons name="door" size={22} color="#0891B2" />
      <View style={{ flex: 1 }}>
        <Text style={{ color: colors.text, fontWeight: '600', fontSize: 15 }}>{room.name}</Text>
        <Text style={{ color: colors.textMuted, fontSize: 12 }}>
          {[room.department?.name, `${room._count?.points ?? 0} pontos`, `${room._count?.devices ?? 0} equipamentos`].filter(Boolean).join(' · ')}
        </Text>
      </View>
    </Pressable>
  );
}

function DepartmentChip({ name, count, onPress }: { name: string; count: number; onPress: () => void }) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} style={{ backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8 }}>
      <Text style={{ color: colors.text, fontWeight: '600' }}>
        {name} <Text style={{ color: colors.textMuted }}>· {count}</Text>
      </Text>
    </Pressable>
  );
}
