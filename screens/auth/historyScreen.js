import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';

import BottomTab from '../components/BottomTab';

export default function HistoryScreen({ navigation, route }) {
  const { uid } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerText}>History</Text>
      </View>

      {/* Content */}
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Profile Card */}
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>

          <View style={styles.profileInfo}>
            <Text style={styles.username}>Alongkot NOKJUN</Text>
            <Text style={styles.subText}>Nov 23, 2024 • 9:40 AM</Text>

            <View style={styles.statsRow}>
              <Stat label="Distance" value="15.01 km" />
              <Stat label="Pace" value="10:39 /km" />
              <Stat label="Badges" value="🏅 8" />
            </View>

            <Text style={styles.congrats}>
              Congrats! New PR – 15K 🎉
            </Text>
          </View>
        </View>

        {/* Run Cards */}
        <RunCard title="Run" distance="8.20 km" time="52:10" pace="6:21" />
        <RunCard title="Walk" distance="3.60 km" time="42:30" pace="11:48" />
      </ScrollView>

      {/* Bottom Tab */}
      <BottomTab
      navigation={navigation}
      uid={uid}
      active="History"  
      />
    </SafeAreaView>
  );
}

/* ---------- Components ---------- */

function Stat({ label, value }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

function RunCard({ title, distance, time, pace }) {
  return (
    <View style={styles.runCard}>
      <View style={styles.runHeader}>
        <Text style={styles.runTitle}>{title}</Text>
        <Text style={styles.runDistance}>{distance}</Text>
      </View>

      <Text style={styles.runSub}>
        {time} • pace {pace}
      </Text>

      {/* mock route */}
      <View style={styles.routeMock} />
    </View>
  );
}

function Tab({ icon, label, active, onPress }) {
  return (
    <Text
      onPress={onPress}
      style={[styles.tabText, active && styles.tabActive]}
    >
      <Ionicons
        name={icon}
        size={16}
        color={active ? '#f97316' : '#6b7280'}
      />{' '}
      {label}
    </Text>
  );
}

/* ---------- Styles (Flex only) ---------- */

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
  },

  header: {
    padding: 16,
  },
  headerText: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 'bold',
  },

  content: {
    padding: 16,
    gap: 12,
  },

  profileCard: {
    flexDirection: 'row',
    backgroundColor: '#111827',
    borderRadius: 16,
    padding: 14,
  },

  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f97316',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontWeight: 'bold',
  },

  profileInfo: {
    flex: 1,
    gap: 4,
  },

  username: {
    color: '#fff',
    fontWeight: 'bold',
  },
  subText: {
    color: '#9ca3af',
    fontSize: 12,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 6,
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontWeight: 'bold',
  },
  statLabel: {
    color: '#9ca3af',
    fontSize: 11,
  },

  congrats: {
    color: '#f97316',
    fontSize: 12,
    marginTop: 4,
  },

  runCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 14,
    gap: 6,
  },

  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  runTitle: {
    color: '#fff',
    fontWeight: 'bold',
  },
  runDistance: {
    color: '#f97316',
  },
  runSub: {
    color: '#9ca3af',
    fontSize: 12,
  },

  routeMock: {
    height: 80,
    borderWidth: 2,
    borderColor: '#f97316',
    borderRadius: 6,
  },

 /* ===== Bottom Tab ===== */
tabBar: {
  flexDirection: "row",
  height: 80,
  backgroundColor: "#0B0E11",
  borderTopWidth: 1,
  borderColor: "#1f2933",
},

tabItem: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
},

tabIconWrap: {
  width: 44,
  height: 44,
  borderRadius: 22,
  alignItems: "center",
  justifyContent: "center",
},

tabIconActive: {
  backgroundColor: "rgba(249,115,22,0.15)", 
},

tabText: {
  color: "#6b7280",
  fontSize: 11,
  marginTop: 4,
},

tabActive: {
  color: "#f97316",
  fontWeight: "bold",
},
});
