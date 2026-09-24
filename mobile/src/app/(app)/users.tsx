import { useState } from 'react';
import { Stack } from 'expo-router';
import { deleteEntity, saveEntity, useSave, useUsers } from '@/api/hooks';
import type { Role, User } from '@/api/types';
import { useAuth } from '@/store/auth';
import { spacing, useTheme } from '@/theme';
import { Badge, Body, Button, Card, ErrorView, Field, Input, ListItem, Loading, Row, Screen, SectionTitle, Segmented, confirm, notify } from '@/components/ui';
import { ROLE_DESCRIPTION, ROLE_LABEL } from '@/lib/labels';

interface Draft {
  id?: string;
  name: string;
  email: string;
  password: string;
  role: Role;
  active: boolean;
}

const EMPTY: Draft = { name: '', email: '', password: '', role: 'TECHNICIAN', active: true };

/** Gestão de usuários (somente administradores). */
export default function UsersScreen() {
  const { colors } = useTheme();
  const me = useAuth((s) => s.user);
  const { data, isLoading, error, refetch, isRefetching } = useUsers();
  const [draft, setDraft] = useState<Draft | null>(null);

  const save = useSave((d: Draft) =>
    d.id
      ? saveEntity('users', d.id, { name: d.name, role: d.role, active: d.active, ...(d.password ? { password: d.password } : {}) })
      : saveEntity('users', undefined, { name: d.name, email: d.email, password: d.password, role: d.role }),
  );
  const remove = useSave((id: string) => deleteEntity('users', id));

  const edit = (u: User) => setDraft({ id: u.id, name: u.name, email: u.email, password: '', role: u.role, active: u.active });
  const submit = () => draft && save.mutate(draft, { onSuccess: () => setDraft(null), onError: (e) => notify('Verifique os dados', e.message) });

  if (isLoading) return <Loading />;
  if (error) return <ErrorView error={error} onRetry={refetch} />;

  return (
    <Screen onRefresh={refetch} refreshing={isRefetching}>
      <Stack.Screen options={{ title: 'Usuários' }} />

      {!draft && <Button title="Novo usuário" icon="account-plus-outline" onPress={() => setDraft(EMPTY)} />}

      {draft && (
        <Card style={{ gap: spacing.lg }}>
          <Body bold size={17}>
            {draft.id ? 'Editar usuário' : 'Novo usuário'}
          </Body>
          <Field label="Nome *">
            <Input value={draft.name} onChangeText={(name) => setDraft({ ...draft, name })} />
          </Field>
          <Field label="E-mail *">
            <Input value={draft.email} editable={!draft.id} onChangeText={(email) => setDraft({ ...draft, email })} autoCapitalize="none" keyboardType="email-address" />
          </Field>
          <Field label={draft.id ? 'Nova senha (deixe em branco para manter)' : 'Senha *'}>
            <Input value={draft.password} onChangeText={(password) => setDraft({ ...draft, password })} secureTextEntry />
          </Field>
          <Field label="Perfil" hint={ROLE_DESCRIPTION[draft.role]}>
            <Segmented<Role>
              value={draft.role}
              onChange={(role) => setDraft({ ...draft, role })}
              options={(['ADMIN', 'TECHNICIAN', 'VIEWER'] as Role[]).map((r) => ({ value: r, label: ROLE_LABEL[r] }))}
            />
          </Field>
          {draft.id && draft.id !== me?.id && (
            <Field label="Acesso">
              <Segmented
                value={draft.active ? 'on' : 'off'}
                onChange={(v) => setDraft({ ...draft, active: v === 'on' })}
                options={[
                  { value: 'on', label: 'Ativo' },
                  { value: 'off', label: 'Bloqueado' },
                ]}
              />
            </Field>
          )}
          <Row>
            <Button title="Cancelar" variant="ghost" style={{ flex: 1 }} onPress={() => setDraft(null)} />
            <Button
              title="Salvar"
              style={{ flex: 1 }}
              onPress={submit}
              loading={save.isPending}
              disabled={!draft.name.trim() || !draft.email.trim() || (!draft.id && draft.password.length < 6)}
            />
          </Row>
          {draft.id && draft.id !== me?.id && (
            <Button
              title="Excluir usuário"
              icon="delete-outline"
              variant="danger"
              onPress={() =>
                confirm('Excluir usuário', `Excluir ${draft.name}? O histórico de alterações dele é mantido.`, () =>
                  remove.mutate(draft.id!, { onSuccess: () => setDraft(null), onError: (e) => notify('Erro', e.message) }),
                )
              }
            />
          )}
        </Card>
      )}

      <SectionTitle>{`${data?.length ?? 0} usuários`}</SectionTitle>
      {data?.map((u) => (
        <ListItem
          key={u.id}
          icon={u.role === 'ADMIN' ? 'shield-account' : u.role === 'TECHNICIAN' ? 'account-wrench' : 'account-eye'}
          title={u.name + (u.id === me?.id ? ' (você)' : '')}
          subtitle={`${u.email}\n${ROLE_LABEL[u.role]}`}
          right={!u.active ? <Badge label="Bloqueado" color={colors.dangerSoft} textColor={colors.danger} /> : undefined}
          onPress={() => edit(u)}
        />
      ))}
    </Screen>
  );
}
