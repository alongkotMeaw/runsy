import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as Location from 'expo-location';
import MapView, { Marker, Polyline } from 'react-native-maps';
import { captureRef } from 'react-native-view-shot';
import * as FileSystem from 'expo-file-system/legacy';
import { Ionicons } from '@expo/vector-icons';

import BottomTab from '../components/BottomTab';

/* Firebase */
import { auth, database } from '../../firebaseConfig';
import { ref, push, set } from 'firebase/database';

/* ---------- Utils ---------- */
const toRad = v => (v * Math.PI) / 180;

const distanceKm = (a, b) => {
  const R = 6371;
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return R * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
};

const formatTime = s => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${sec.toString().padStart(2, '0')}`;
};

/* ---------- Screen ---------- */
export default function RunScreen({ navigation, route }) {
  const { uid } = route.params;

  const [location, setLocation] = useState(null);
  const [coords, setCoords] = useState([]);
  const [watcher, setWatcher] = useState(null);
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0);

  const timerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    Location.requestForegroundPermissionsAsync();
  }, []);

  /* ---------- Timer ---------- */
  const startTimer = () => {
    timerRef.current = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  /* ---------- Start Run ---------- */
  const startRun = async () => {
    setSeconds(0);
    setDistance(0);
    setCoords([]);

    startTimer();

    const sub = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        timeInterval: 1000,
        distanceInterval: 5,
      },
      loc => {
        const point = {
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        };

        setLocation(point);
        setCoords(prev => {
          if (prev.length > 0) {
            setDistance(d => d + distanceKm(prev[prev.length - 1], point));
          }
          return [...prev, point];
        });
      }
    );

    setWatcher(sub);
  };

  /* ---------- STOP → SAVE ---------- */
  const stopRun = async () => {
    watcher?.remove();
    setWatcher(null);
    stopTimer();

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'ยังไม่ได้ล็อกอิน');
        return;
      }

      await new Promise(r => setTimeout(r, 500));

      const tempUri = await captureRef(mapRef, {
        format: 'jpg',
        quality: 0.8,
      });

      const filename = `run-map-${Date.now()}.jpg`;
      const localUri = FileSystem.documentDirectory + filename;

      await FileSystem.moveAsync({
        from: tempUri,
        to: localUri,
      });

      const pace =
        distance > 0
          ? `${Math.floor(seconds / 60 / distance)}:${Math.floor(
              (seconds / distance) % 60
            )
              .toString()
              .padStart(2, '0')}`
          : '--';

      const runData = {
        time: seconds,
        distance: Number(distance.toFixed(2)),
        pace,
        route: coords,
        mapImage: localUri,
        createdAt: Date.now(),
      };

      const runRef = push(ref(database, `users/${uid}/runs`));
      await set(runRef, runData);

      Alert.alert('Success', 'บันทึกการวิ่งเรียบร้อย');
      console.log('SAVED RUN:', runData);
    } catch (e) {
      console.log('SAVE ERROR:', e);
      Alert.alert('Error', e.message);
    }

    setSeconds(0);
    setDistance(0);
    setCoords([]);
    setLocation(null);
  };

  const pace =
    distance > 0
      ? `${Math.floor(seconds / 60 / distance)}:${Math.floor(
          (seconds / distance) % 60
        )
          .toString()
          .padStart(2, '0')}`
      : '--';

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.header}>Run</Text>

      <View style={styles.card}>
        <Text style={styles.time}>{formatTime(seconds)}</Text>
        <View style={styles.row}>
          <Stat value={distance.toFixed(2)} label="Distance (km)" />
          <Stat value={pace} label="Avg Pace" />
        </View>
      </View>

      <View style={styles.map} ref={mapRef} collapsable={false}>
        <MapView
          style={{ flex: 1 }}
          showsUserLocation
          region={
            location && {
              ...location,
              latitudeDelta: 0.005,
              longitudeDelta: 0.005,
            }
          }
        >
          {location && <Marker coordinate={location} />}
          <Polyline coordinates={coords} strokeWidth={5} strokeColor="#ff7a00" />
        </MapView>
      </View>

      <Pressable
        style={styles.startBtn}
        onPress={watcher ? stopRun : startRun}
      >
        <Text style={styles.startText}>
          {watcher ? 'STOP & SAVE' : 'START'}
        </Text>
      </Pressable>

     {/* Bottom Tab */}
      <BottomTab
      navigation={navigation}
      uid={uid}
      active="Run"  
      />

      <View style={{flex: 1}}></View>
     
    </SafeAreaView>
  );
}

/* ---------- Components ---------- */
function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}





/* ---------- Styles ---------- */
const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f0f0f', 
    padding: 16 
  },
  header: { 
    color: '#fff', 
    fontSize: 20, 
    marginBottom: 8 
  },
  card: {
    borderWidth: 2,
    borderColor: '#00aaff',
    borderRadius: 12,
    padding: 16,
  },
  time: { 
    color: '#fff', 
    fontSize: 32, 
    textAlign: 'center' 
  },
  row: { 
    flexDirection: 'row', 
    justifyContent: 'space-around', 
    marginTop: 8 
  },
  stat: { alignItems: 'center' },
  value: { color: '#fff', fontSize: 16 },
  label: { color: '#888', fontSize: 12 },
  map: {
    flex: 7,
    marginVertical: 16,
    borderRadius: 12,
    overflow: 'hidden',
  },
  startBtn: {
    backgroundColor: '#ff7a00',
    borderRadius: 30,
    padding: 16,
    alignItems: 'center',
    marginBottom: 16,
  },
  startText: { fontSize: 18, fontWeight: 'bold' },

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
