import { useState } from 'react';
import { router } from 'expo-router';
import { api } from '@/api/client';
import { useAuth, usePermissions } from '@/store/auth';
import { ThemeMode, useThemeStore } from '@/store/theme';
import { spacing } from '@/theme';
import { Body, Button, Card, Field, IconBadge, Input, ListItem, Row, Screen, SectionTitle, Segmented, notify } from '@/components/ui';
import { ROLE_DESCRIPTION, ROLE_LABEL } from '@/lib/labels';
import { exportInventory } from '@/lib/download';

export default function SettingsScreen() {
  const { user, apiUrl, setApiUrl, logout } = useAuth();
  const { isAdmin } = usePermissions();
  const { mode, setMode } = useThemeStore();
  const [server, setServer] = useState(apiUrl);
  const [pwd, setPwd] = useState({ current: '', next: '' });
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);

  const changePassword = async () => {
    setSaving(true);
    try {
      await api('/auth/change-password', { method: 'POST', body: { currentPassword: pwd.current, newPassword: pwd.next } });
      setPwd({ current: '', next: '' });
      notify('Senha alterada com sucesso');
    } catch (e) {
      notify('Não foi possível alterar a senha', e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(false);
    }
  };

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

  return (
    <Screen>
      {user && (
        <Card>
          <Row gap={spacing.md}>
            <IconBadge name="account" size={52} />
            <Body bold size={18}>
              {user.name}
            </Body>
          </Row>
          <Body muted>{user.email}</Body>
          <Body bold>{ROLE_LABEL[user.role]}</Body>
          <Body muted size={13}>
            {ROLE_DESCRIPTION[user.role]}
          </Body>
        </Card>
      )}

      <SectionTitle>Aparência</SectionTitle>
      <Segmented<ThemeMode>
        value={mode}
        onChange={setMode}
        options={[
          { value: 'system', label: 'Automático' },
          { value: 'light', label: 'Claro' },
          { value: 'dark', label: 'Escuro' },
        ]}
      />

      <SectionTitle>Dados</SectionTitle>
      <ListItem icon="history" title="Histórico de alterações" onPress={() => router.push('/history')} />
      {isAdmin && (
        <>
          <ListItem icon="microsoft-excel" iconColor="#15803D" title={exporting ? 'Gerando planilha…' : 'Exportar inventário'} subtitle="Planilha .xlsx com 4 abas" onPress={doExport} />
          <ListItem icon="file-import-outline" iconColor="#15803D" title="Importar planilha" subtitle="Equipamentos e pontos de rede" onPress={() => router.push('/import')} />
          <ListItem icon="account-group-outline" title="Usuários do sistema" subtitle="Administradores, técnicos e consulta" onPress={() => router.push('/users')} />
        </>
      )}

      <SectionTitle>Servidor</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <Field label="Endereço da API" hint="Use o IP do servidor na rede da empresa">
          <Input value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} icon="server-network" />
        </Field>
        <Button title="Salvar endereço" variant="secondary" disabled={server === apiUrl} onPress={() => setApiUrl(server)} />
      </Card>

      <SectionTitle>Alterar senha</SectionTitle>
      <Card style={{ gap: spacing.md }}>
        <Input placeholder="Senha atual" secureTextEntry value={pwd.current} onChangeText={(current) => setPwd((p) => ({ ...p, current }))} icon="lock-outline" />
        <Input placeholder="Nova senha (mín. 6 caracteres)" secureTextEntry value={pwd.next} onChangeText={(next) => setPwd((p) => ({ ...p, next }))} icon="lock-reset" />
        <Button title="Alterar senha" variant="secondary" loading={saving} disabled={!pwd.current || pwd.next.length < 6} onPress={changePassword} />
      </Card>

      <Button title="Sair" icon="logout" variant="danger" onPress={logout} style={{ marginTop: spacing.lg }} />
    </Screen>
  );
}
