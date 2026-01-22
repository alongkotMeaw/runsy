import React from "react";
import {View,Text,StyleSheet,Pressable,} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomTab from '../components/BottomTab';

export default function ProfileScreen({ navigation, route }) {
  const { uid } = route.params;

  return (
    <SafeAreaView style={styles.container}>
      {/* ===== CONTENT ===== */}
      <View style={styles.content}>
        {/* Header */}
        <View style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>A</Text>
          </View>

          <View style={styles.headerInfo}>
            <Text style={styles.name}>Alongkot NOKJUN</Text>
            <Text style={styles.subText}>Chiang Mai, Thailand</Text>
            <Text style={styles.subText}>Runner • Since 2024</Text>
          </View>
        </View>

        {/* Stats */}
        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statValue}>24</Text>
            <Text style={styles.statLabel}>Total Runs</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statValue}>142 km</Text>
            <Text style={styles.statLabel}>Distance</Text>
          </View>

          <View style={styles.statBox}>
            <Text style={styles.statValue}>🏅 8</Text>
            <Text style={styles.statLabel}>Achievements</Text>
          </View>
        </View>

        {/* Records */}
        <Text style={styles.sectionTitle}>Personal Records</Text>

        <View style={styles.recordItem}>
          <Text style={styles.recordTitle}>5K</Text>
          <Text style={styles.recordValue}>27:40</Text>
        </View>

        <View style={styles.recordItem}>
          <Text style={styles.recordTitle}>10K</Text>
          <Text style={styles.recordValue}>59:10</Text>
        </View>

        <View style={styles.recordItem}>
          <Text style={styles.recordTitle}>Half Marathon</Text>
          <Text style={styles.recordValue}>1:53:30</Text>
        </View>

        {/* Settings */}
        <Text style={styles.sectionTitle}>Settings</Text>

        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Edit Profile</Text>
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Privacy & Security</Text>
        </View>

        <View style={styles.settingItem}>
          <Text style={styles.settingText}>Logout</Text>
        </View>
      </View>

      {/* Bottom Tab */}
      <BottomTab
      navigation={navigation}
      uid={uid}
      active="Profile"  
      />
    </SafeAreaView>
  );
}

/* ---------- Components ---------- */
function TabItem({ name, icon, active, onPress }) {
  return (
    <Pressable onPress={onPress} style={styles.tabItem}>
      <View
        style={[
          styles.tabIconWrap,
          active && styles.tabIconActive,
        ]}
      >
        <Ionicons
          name={icon}
          size={22}
          color={active ? "#f97316" : "#6b7280"}
        />
      </View>

      <Text style={[styles.tabText, active && styles.tabActive]}>
        {name}
      </Text>
    </Pressable>
  );
}

/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0B0E11",
    padding: 16,
  },

  content: {
    flex: 1,
    padding: 16,
  },

  headerCard: {
    flexDirection: "row",
    backgroundColor: "#11161C",
    padding: 16,
    borderRadius: 16,
    marginBottom: 16,
    alignItems: "center",
  },

  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#FF8C00",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  avatarText: {
    fontSize: 22,
    fontWeight: "bold",
    color: "#000",
  },

  headerInfo: { flex: 1 },

  name: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  subText: {
    color: "#888",
    fontSize: 12,
    marginTop: 2,
  },

  statsRow: {
    flexDirection: "row",
    marginBottom: 20,
  },

  statBox: {
    flex: 1,
    backgroundColor: "#11161C",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
    marginHorizontal: 4,
  },

  statValue: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "bold",
  },

  statLabel: {
    color: "#888",
    fontSize: 11,
    marginTop: 4,
  },

  sectionTitle: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
    marginBottom: 8,
  },

  recordItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: "#11161C",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },

  recordTitle: {
    color: "#fff",
    fontSize: 13,
  },

  recordValue: {
    color: "#888",
    fontSize: 13,
  },

  settingItem: {
    backgroundColor: "#11161C",
    padding: 14,
    borderRadius: 12,
    marginBottom: 8,
  },

  settingText: {
    color: "#fff",
    fontSize: 13,
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
