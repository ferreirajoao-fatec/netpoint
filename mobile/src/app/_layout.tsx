import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuth } from '@/store/auth';
import { useThemeStore } from '@/store/theme';
import { useTheme } from '@/theme';
import { Loading } from '@/components/ui';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 15_000 } },
});

export default function RootLayout() {
  const ready = useAuth((s) => s.ready);
  const token = useAuth((s) => s.token);
  const { colors, isDark } = useTheme();

  useEffect(() => {
    useAuth.getState().hydrate();
    useThemeStore.getState().hydrate();
  }, []);

  // Ao sair (ou sessão expirada), limpa os dados em cache do usuário anterior
  useEffect(() => {
    if (!token) queryClient.clear();
  }, [token]);

  if (!ready) return <Loading label="Abrindo o NetPoint…" />;

  return (
    <QueryClientProvider client={queryClient}>
      <SafeAreaProvider>
        <StatusBar style={isDark ? 'light' : 'dark'} />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.background } }}>
          {/* Todo o app exige login; deep links de QR Code abertos sem sessão passam pelo login */}
          <Stack.Protected guard={!!token}>
            <Stack.Screen name="(app)" />
          </Stack.Protected>
          <Stack.Protected guard={!token}>
            <Stack.Screen name="login" />
          </Stack.Protected>
        </Stack>
      </SafeAreaProvider>
    </QueryClientProvider>
  );
}
