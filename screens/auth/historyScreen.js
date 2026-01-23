import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import BottomTab from '../components/BottomTab';

/* Firebase */
import { database } from '../../firebaseConfig';
import { ref, onValue } from 'firebase/database';

/* ---------- Utils ---------- */
const formatTime = s => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/* ---------- Screen ---------- */
export default function HistoryScreen({ navigation, route }) {
  const { uid } = route.params;

  const [runs, setRuns] = useState([]);

  useEffect(() => {
    if (!uid) return;

    const runsRef = ref(database, `users/${uid}/runs`);
    const unsub = onValue(runsRef, snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .sort((a, b) => b.createdAt - a.createdAt);
        setRuns(list);
      } else {
        setRuns([]);
      }
    });

    return () => unsub();
  }, [uid]);

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
        {runs.length === 0 && (
          <Text style={styles.emptyText}>ยังไม่มีประวัติการวิ่ง</Text>
        )}

        {runs.map(run => (
          <RunCard
            key={run.id}
            distance={`${run.distance} km`}
            time={formatTime(run.time)}
            pace={`${run.pace} /km`}
            image={run.mapImage}
          />
        ))}
      </ScrollView>

      {/* Bottom Tab */}
      <BottomTab navigation={navigation} uid={uid} active="History" />
    </SafeAreaView>
  );
}

/* ---------- Components ---------- */

function RunCard({ distance, time, pace, image }) {
  return (
    <View style={styles.runCard}>
      <View style={styles.runHeader}>
        <Text style={styles.runTitle}>Run</Text>
        <Text style={styles.runDistance}>{distance}</Text>
      </View>

      <Text style={styles.runSub}>
        {time} • pace {pace}
      </Text>

      {image && (
        <Image source={{ uri: image }} style={styles.routeImage} />
      )}
    </View>
  );
}

/* ---------- Styles ---------- */

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

  emptyText: {
    color: '#9ca3af',
    textAlign: 'center',
    marginTop: 40,
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

  routeImage: {
    height: 140,
    borderRadius: 8,
    marginTop: 8,
  },
});
