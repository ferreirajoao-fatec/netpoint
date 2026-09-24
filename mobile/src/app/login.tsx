import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api } from '@/api/client';
import type { User } from '@/api/types';
import { useAuth } from '@/store/auth';
import { spacing, useTheme } from '@/theme';
import { Body, Button, Card, Field, IconBadge, Input, Title } from '@/components/ui';

export default function LoginScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { apiUrl, setApiUrl, setSession } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [server, setServer] = useState(apiUrl);
  const [showServer, setShowServer] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError(null);
    setLoading(true);
    try {
      if (server !== apiUrl) await setApiUrl(server);
      const res = await api<{ accessToken: string; user: User }>('/auth/login', { method: 'POST', body: { email, password } });
      await setSession(res.accessToken, res.user);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', padding: spacing.xl, paddingTop: insets.top + spacing.xl, gap: spacing.xl }}>
        <View style={{ alignItems: 'center', gap: spacing.md }}>
          <IconBadge name="lan" size={84} />
          <Title size={32}>NetPoint</Title>
          <Body muted center>
            Descubra em segundos onde cada equipamento está conectado na rede.
          </Body>
        </View>

        <Card style={{ gap: spacing.lg }}>
          <Field label="E-mail">
            <Input
              icon="email-outline"
              value={email}
              onChangeText={setEmail}
              placeholder="seu.email@empresa.com"
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
          </Field>
          <Field label="Senha">
            <Input icon="lock-outline" value={password} onChangeText={setPassword} placeholder="••••••" secureTextEntry onSubmitEditing={submit} />
          </Field>
          {showServer && (
            <Field label="Endereço do servidor (API)" hint="Ex.: http://192.168.0.10:3000/api">
              <Input icon="server-network" value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} />
            </Field>
          )}
          {error && <Body>{`⚠️ ${error}`}</Body>}
          <Button title="Entrar" icon="login" onPress={submit} loading={loading} disabled={!email || !password} />
          <Button title={showServer ? 'Ocultar servidor' : 'Configurar servidor'} variant="ghost" icon="cog-outline" onPress={() => setShowServer((v) => !v)} />
        </Card>

        <Body muted center size={13}>
          Demonstração: admin@netpoint.local / admin123
        </Body>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
