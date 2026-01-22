import { View, Text, StyleSheet, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { ref, get } from 'firebase/database';
import { database } from '../../firebaseConfig';
import { useEffect, useState } from 'react';

import BottomTab from '../components/BottomTab';


export default function MainScreen({  route, navigation  }) {
  const { uid } = route.params;
  const [user, setUser] = useState(null);

  useEffect(() => {
    const fetchUser = async () => {
      const snapshot = await get(ref(database, 'users/' + uid));
      if (snapshot.exists()) {
        setUser(snapshot.val());
      }
    };

    fetchUser();
  }, []);

  if (!user) return null;

  //ui tap function
  function TabItem({ name, active, onPress }) {
  return (
    <Pressable onPress={onPress}>
      <Text style={[styles.tabText, active && styles.tabActive]}>
        {name}
      </Text>
    </Pressable>
  );
  }

//ui
  return (
    <SafeAreaView style={styles.container}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Good Evening 👋</Text>
          <Text style={styles.name}> {user.username}, ready to run?</Text>
        </View>
        <View style={styles.avatar} />
      </View>

      {/* Start Run Card */}
      <Pressable
        style={styles.startCard}
        onPress={() => navigation.navigate('Run', { uid })}>
          <Text style={styles.startText}>START RUN</Text>
          <Ionicons name="play" size={20} color="#000" />
      </Pressable>


      {/* Today's Stats */}
      <Text style={styles.sectionTitle}>Today's Stats</Text>
      <View style={styles.statsRow}>
        <StatBox title="km" value="3.2" />
        <StatBox title="min" value="20" />
        <StatBox title="pace" value="6:15" />
      </View>

      {/* Weekly Goal */}
      <Text style={styles.sectionTitle}>Weekly Goal</Text>
      <View style={styles.goalCard}>
        <Text style={styles.goalText}>12 / 20 km</Text>
        <View style={styles.progressBg}>
          <View style={styles.progressFill} />
        </View>
      </View>

      {/* Ranking */}
      <Text style={styles.sectionTitle}>แรงจูงใจ - การจัดอันดับ</Text>
      <View style={styles.rankRow}>
        <RankCard rank="#2" name="user2" km="105.45 km" />
        <RankCard rank="#1" name="user1" km="125.84 km" highlight />
        <RankCard rank="#3" name="user3" km="92.00 km" />
      </View>

      {/* Bottom Tab */}
       <BottomTab
        navigation={navigation}
        uid={uid}
        active="Home"  
       />


    </SafeAreaView>
  );
}

/* ---------- Small Components ---------- */

function StatBox({ title, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statTitle}>{title}</Text>
    </View>
  );
}

function RankCard({ rank, name, km, highlight }) {
  return (
    <View style={[styles.rankCard, highlight && styles.rankHighlight]}>
      <Text style={styles.rank}>{rank}</Text>
      <Text style={styles.rankName}>{name}</Text>
      <Text style={styles.rankKm}>{km}</Text>
    </View>
  );
}




const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0b0b0f',
    padding: 16,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  greeting: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  name: {
    color: '#9ca3af',
    fontSize: 13,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#1f2933',
  },

  startCard: {
    backgroundColor: '#111827',
    borderRadius: 14,
    padding: 20,
    marginVertical: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  startText: {
    color: '#f97316',
    fontWeight: 'bold',
    fontSize: 16,
  },

  sectionTitle: {
    color: '#fff',
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 16,
  },

  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  statBox: {
    backgroundColor: '#111827',
    width: '30%',
    borderRadius: 12,
    padding: 12,
    alignItems: 'center',
  },
  statValue: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
  statTitle: {
    color: '#9ca3af',
    fontSize: 12,
  },

  goalCard: {
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
  },
  goalText: {
    color: '#fff',
    marginBottom: 6,
  },
  progressBg: {
    height: 6,
    backgroundColor: '#1f2933',
    borderRadius: 3,
  },
  progressFill: {
    width: '60%',
    height: 6,
    backgroundColor: '#22c55e',
    borderRadius: 3,
  },

  rankRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  rankCard: {
    backgroundColor: '#111827',
    width: '30%',
    borderRadius: 12,
    padding: 10,
    alignItems: 'center',
  },
  rankHighlight: {
    backgroundColor: '#f97316',
  },
  rank: {
    color: '#fff',
    fontWeight: 'bold',
  },
  rankName: {
    color: '#fff',
    fontSize: 12,
    marginVertical: 4,
  },
  rankKm: {
    color: '#e5e7eb',
    fontSize: 11,
  },

});
