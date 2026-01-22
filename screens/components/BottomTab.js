import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function BottomTab({ navigation, uid, active }) {
  const insets = useSafeAreaInsets();

  return (
    <View
      style={[
        styles.tabBar,
        {   height: 80 + insets.bottom,   
            paddingBottom: insets.bottom }, 
      ]}
    >
      <TabItem
        name="Home"
        icon="home"
        active={active === 'Home'}
        onPress={() => navigation.navigate('Dashboard', { uid })}
      />
      <TabItem
        name="Run"
        icon="walk"
        active={active === 'Run'}
        onPress={() => navigation.navigate('Run', { uid })}
      />
      <TabItem
        name="History"
        icon="time"
        active={active === 'History'}
        onPress={() => navigation.navigate('History', { uid })}
      />
      <TabItem
        name="Profile"
        icon="person"
        active={active === 'Profile'}
        onPress={() => navigation.navigate('Profile', { uid })}
      />
    </View>
  );
}

function TabItem({ name, icon, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <View style={[styles.iconWrap, active && styles.iconActive]}>
        <Ionicons
          name={icon}
          size={22}
          color={active ? '#f97316' : '#6b7280'}
        />
      </View>
      <Text style={[styles.text, active && styles.textActive]}>
        {name}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
 tabBar: {
  flexDirection: 'row',
  backgroundColor: '#0B0E11',
  borderTopWidth: 1,
  borderColor: '#1f2933',
  position: 'absolute',
  left: 0,
  right: 0,
  bottom: 0,
},

  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconActive: {
    backgroundColor: 'rgba(249,115,22,0.15)',
  },
  text: {
    fontSize: 11,
    color: '#6b7280',
    marginTop: 4,
  },
  textActive: {
    color: '#f97316',
    fontWeight: 'bold',
  },
});
