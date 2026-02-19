import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { auth } from '../../firebaseConfig';
import { gradients, palette, radii, shadows } from '../../theme/premiumTheme';

const tabs = [
  { name: 'Home', icon: 'home', screen: 'Dashboard' },
  { name: 'Run', icon: 'walk', screen: 'Run' },
  { name: 'History', icon: 'time', screen: 'History' },
  { name: 'Profile', icon: 'person', screen: 'Profile' },
];

export default function BottomTab({ navigation, uid, active }) {
  const insets = useSafeAreaInsets();
  const currentUid = uid || auth.currentUser?.uid;

  return (
    <View
      style={[
        styles.wrapper,
        {
          paddingBottom: Math.max(8, insets.bottom + 2),
        },
      ]}
    >
      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.tabBar}
      >
        {tabs.map(tab => (
          <TabItem
            key={tab.name}
            name={tab.name}
            icon={tab.icon}
            active={active === tab.name}
            onPress={() => navigation.navigate(tab.screen, { uid: currentUid })}
          />
        ))}
      </LinearGradient>
    </View>
  );
}

function TabItem({ name, icon, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <View style={[styles.iconWrap, active && styles.iconActive]}>
        <Ionicons
          name={icon}
          size={20}
          color={active ? palette.textPrimary : palette.textMuted}
        />
      </View>
      <Text style={[styles.text, active && styles.textActive]}>{name}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
  },
  tabBar: {
    flexDirection: 'row',
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    overflow: 'hidden',
    ...shadows.soft,
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: {
    backgroundColor: 'rgba(249,115,22,0.26)',
  },
  text: {
    marginTop: 3,
    fontSize: 11,
    color: palette.textMuted,
    fontWeight: '600',
  },
  textActive: {
    color: palette.textPrimary,
  },
});
