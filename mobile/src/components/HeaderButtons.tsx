import { Pressable, View } from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '@/theme';
import type { IconName } from '@/lib/labels';

/** Botões de ícone no cabeçalho das telas de detalhes (QR Code, editar…). */
export function HeaderButtons({ buttons }: { buttons: { icon: IconName; label: string; onPress: () => void; hidden?: boolean }[] }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: 18, paddingHorizontal: 4 }}>
      {buttons
        .filter((b) => !b.hidden)
        .map((b) => (
          <Pressable key={b.label} onPress={b.onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={b.label}>
            <MaterialCommunityIcons name={b.icon} size={24} color={colors.primary} />
          </Pressable>
        ))}
    </View>
  );
}
