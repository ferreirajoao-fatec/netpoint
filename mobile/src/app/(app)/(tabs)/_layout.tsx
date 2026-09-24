import { Tabs } from 'expo-router';
import type { ColorValue } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import type { IconName } from '@/lib/labels';

const tab = (title: string, icon: IconName, iconActive: IconName) => ({
  title,
  tabBarIcon: ({ color, focused }: { color: ColorValue; focused: boolean }) => (
    <MaterialCommunityIcons name={focused ? iconActive : icon} size={26} color={color} />
  ),
});

export default function TabsLayout() {
  const { colors } = useTheme();
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.tabBar, borderTopColor: colors.border, height: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600', paddingBottom: 6 },
        headerStyle: { backgroundColor: colors.surface },
        headerTintColor: colors.text,
        headerTitleStyle: { fontWeight: '700' },
        headerShadowVisible: false,
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen name="index" options={{ ...tab('Início', 'home-outline', 'home'), headerShown: false }} />
      <Tabs.Screen name="search" options={{ ...tab('Pesquisar', 'magnify', 'magnify'), title: 'Rastrear conexão', tabBarLabel: 'Pesquisar' }} />
      <Tabs.Screen name="network" options={{ ...tab('Rede', 'lan', 'lan'), title: 'Rede' }} />
      <Tabs.Screen name="qr" options={{ ...tab('QR Code', 'qrcode-scan', 'qrcode-scan'), title: 'Ler QR Code', tabBarLabel: 'QR Code' }} />
      <Tabs.Screen name="settings" options={{ ...tab('Configurações', 'cog-outline', 'cog'), title: 'Configurações', tabBarLabel: 'Ajustes' }} />
    </Tabs>
  );
}
