import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, Alert, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Pedometer } from 'expo-sensors';
import * as FileSystem from 'expo-file-system/legacy';

import BottomTab from '../components/BottomTab';

/* Firebase */
import { auth, database } from '../../firebaseConfig';
import { ref, push, set, get } from 'firebase/database';
import {
  gradients,
  palette,
  radii,
  shadows,
  spacing,
  typography,
} from '../../theme/premiumTheme';

/* ---------- Utils ---------- */
const toRad = value => (value * Math.PI) / 180;

const distanceKmBetween = (a, b) => {
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

const formatClock = totalSeconds => {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(safeSeconds / 3600);
  const m = Math.floor((safeSeconds % 3600) / 60);
  const s = safeSeconds % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatPace = (seconds, distanceKm) => {
  if (!Number.isFinite(seconds) || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return '--';
  }

  const paceSeconds = Math.round(seconds / distanceKm);
  const minutes = Math.floor(paceSeconds / 60);
  const remainder = paceSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

const formatNumber = (value, digits = 1) => {
  if (!Number.isFinite(value)) return '--';
  return value.toFixed(digits);
};

const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

const estimateSteps = distanceKm => {
  const STRIDE_METERS = 0.78;
  return Math.max(0, Math.round((distanceKm * 1000) / STRIDE_METERS));
};

const DEFAULT_REGION = {
  latitude: 18.7883,
  longitude: 98.9853,
  latitudeDelta: 0.02,
  longitudeDelta: 0.02,
};

const MAP_ENABLED = Boolean(process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY);

const MIN_SAVE_SECONDS = 15;
const MIN_SAVE_DISTANCE_KM = 0.05;
const MAX_SEGMENT_KM = 0.3;
const MIN_SEGMENT_KM = 0.003;
const MAX_LOCATION_ACCURACY_M = 30;
const TARGET_INITIAL_ACCURACY_M = 20;
const INITIAL_FIX_ATTEMPTS = 4;
const MAX_PLAUSIBLE_RUNNING_SPEED_KMH = 35;
const SNAP_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };
const DEFAULT_WEIGHT_KG = 65;
const KCAL_PER_KM_PER_KG = 1.036;

/* ---------- Screen ---------- */
export default function RunScreen({ navigation, route }) {
  const uid = route?.params?.uid || auth.currentUser?.uid;

  const [location, setLocation] = useState(null);
  const [coords, setCoords] = useState([]);
  const [seconds, setSeconds] = useState(0);
  const [distance, setDistance] = useState(0);
  const [hasLocationPermission, setHasLocationPermission] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isBusy, setIsBusy] = useState(false);

  const [stepCount, setStepCount] = useState(0);
  const [stepSensorAvailable, setStepSensorAvailable] = useState(null);
  const [hasStepPermission, setHasStepPermission] = useState(null);
  const [instantSpeedKmh, setInstantSpeedKmh] = useState(0);
  const [elevationGainM, setElevationGainM] = useState(0);
  const [userWeightKg, setUserWeightKg] = useState(DEFAULT_WEIGHT_KG);

  const timerRef = useRef(null);
  const watcherRef = useRef(null);
  const pedometerSubRef = useRef(null);
  const runStartedAtRef = useRef(null);
  const runStartedTimestampRef = useRef(null);
  const lastAltitudeRef = useRef(null);
  const lastAcceptedPointRef = useRef(null);
  const lastAcceptedTimestampRef = useRef(null);
  const mapCaptureRef = useRef(null);
  const mapViewRef = useRef(null);

  let mapModule = null;
  if (MAP_ENABLED) {
    try {
      mapModule = require('react-native-maps');
    } catch (error) {
      mapModule = null;
    }
  }

  const MapView = mapModule?.default;
  const Marker = mapModule?.Marker;
  const Polyline = mapModule?.Polyline;

  const usingSensorSteps = stepSensorAvailable === true && hasStepPermission === true;
  const totalSteps = usingSensorSteps ? stepCount : estimateSteps(distance);

  const avgSpeedKmh = useMemo(() => {
    if (!seconds) return 0;
    return distance / (seconds / 3600);
  }, [distance, seconds]);

  const displaySpeedKmh = instantSpeedKmh > 0 ? instantSpeedKmh : avgSpeedKmh;
  const cadenceSpm = seconds > 0 ? Math.round((totalSteps / seconds) * 60) : 0;
  const calories = Math.max(0, Math.round(distance * userWeightKg * KCAL_PER_KM_PER_KG));

  const stopLocationTracking = () => {
    watcherRef.current?.remove();
    watcherRef.current = null;
  };

  const stopStepTracking = () => {
    pedometerSubRef.current?.remove();
    pedometerSubRef.current = null;
  };

  const resetRunState = () => {
    setSeconds(0);
    setDistance(0);
    setCoords([]);
    setLocation(null);
    setStepCount(0);
    setInstantSpeedKmh(0);
    setElevationGainM(0);
    runStartedAtRef.current = null;
    runStartedTimestampRef.current = null;
    lastAltitudeRef.current = null;
    lastAcceptedPointRef.current = null;
    lastAcceptedTimestampRef.current = null;
  };

  useEffect(() => {
    let active = true;

    const loadWeight = async () => {
      if (!uid) return;

      try {
        const weightSnap = await get(ref(database, `users/${uid}/weight`));
        if (!active || !weightSnap.exists()) return;

        const parsed = Number(weightSnap.val());
        if (Number.isFinite(parsed) && parsed > 0) {
          setUserWeightKg(parsed);
        }
      } catch (error) {
        // Keep default weight if profile fetch fails.
      }
    };

    loadWeight();

    return () => {
      active = false;
    };
  }, [uid]);

  useEffect(() => {
    return () => {
      stopLocationTracking();
      stopStepTracking();
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, []);

  const getElapsedSeconds = () => {
    if (!runStartedAtRef.current) return 0;
    return Math.max(0, Math.floor((Date.now() - runStartedAtRef.current) / 1000));
  };

  const startTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setSeconds(getElapsedSeconds());
    }, 500);
  };

  const stopTimer = () => {
    const elapsed = getElapsedSeconds();
    setSeconds(elapsed);

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    return elapsed;
  };

  const focusMapOnPoint = (point, duration = 600) => {
    if (!mapViewRef.current || !point) return;

    mapViewRef.current.animateToRegion(
      {
        latitude: point.latitude,
        longitude: point.longitude,
        latitudeDelta: 0.0045,
        longitudeDelta: 0.0045,
      },
      duration
    );
  };

  const fitMapToRoute = async () => {
    if (!mapViewRef.current) return;

    if (coords.length > 1 && typeof mapViewRef.current.fitToCoordinates === 'function') {
      mapViewRef.current.fitToCoordinates(coords, {
        edgePadding: SNAP_PADDING,
        animated: false,
      });
      await wait(420);
      return;
    }

    if (location) {
      focusMapOnPoint(location, 0);
      await wait(300);
    }
  };

  const requestLocationPermission = async () => {
    let Location;
    try {
      Location = await import('expo-location');
    } catch (error) {
      Alert.alert('Error', 'Location module is unavailable');
      return null;
    }

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      const granted = status === 'granted';
      setHasLocationPermission(granted);
      if (!granted) {
        Alert.alert('Location required', 'Please allow location permission');
        return null;
      }
      return Location;
    } catch (error) {
      setHasLocationPermission(false);
      Alert.alert('Error', 'Unable to request location permission');
      return null;
    }
  };

  const getAccuracyMeters = coords => {
    const raw = Number(coords?.accuracy);
    return Number.isFinite(raw) ? raw : null;
  };

  const enableHighAccuracyProviderIfAvailable = async Location => {
    if (Platform.OS !== 'android' || typeof Location.enableNetworkProviderAsync !== 'function') {
      return;
    }

    try {
      await Location.enableNetworkProviderAsync();
    } catch (error) {
      // User can decline the system dialog; tracking still starts with current provider settings.
    }
  };

  const getBestInitialFix = async Location => {
    let best = null;

    for (let attempt = 0; attempt < INITIAL_FIX_ATTEMPTS; attempt += 1) {
      try {
        const candidate = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.BestForNavigation,
          maximumAge: 0,
          timeout: 12000,
          mayShowUserSettingsDialog: true,
        });

        const candidateAccuracy = getAccuracyMeters(candidate.coords);
        const bestAccuracy = best ? getAccuracyMeters(best.coords) : null;

        if (
          !best ||
          (candidateAccuracy !== null &&
            (bestAccuracy === null || candidateAccuracy < bestAccuracy))
        ) {
          best = candidate;
        }

        if (candidateAccuracy !== null && candidateAccuracy <= TARGET_INITIAL_ACCURACY_M) {
          break;
        }
      } catch (error) {
        // Keep trying; some devices need multiple attempts for first GPS lock.
      }
    }

    return best;
  };

  const startStepTracking = async () => {
    setStepCount(0);

    try {
      const available = await Pedometer.isAvailableAsync();
      setStepSensorAvailable(available);

      if (!available) {
        setHasStepPermission(false);
        return;
      }

      let granted = true;
      if (typeof Pedometer.getPermissionsAsync === 'function') {
        const current = await Pedometer.getPermissionsAsync();
        granted = Boolean(current?.granted);

        if (!granted && typeof Pedometer.requestPermissionsAsync === 'function') {
          const requested = await Pedometer.requestPermissionsAsync();
          granted = Boolean(requested?.granted);
        }
      }

      setHasStepPermission(granted);
      if (!granted) return;

      stopStepTracking();
      pedometerSubRef.current = Pedometer.watchStepCount(result => {
        const next = Number(result?.steps);
        if (Number.isFinite(next) && next >= 0) {
          setStepCount(next);
        }
      });
    } catch (error) {
      setStepSensorAvailable(false);
      setHasStepPermission(false);
    }
  };

  const startRun = async () => {
    if (isBusy || isRunning) return;

    if (!uid) {
      Alert.alert('Error', 'User session not found');
      return;
    }

    setIsBusy(true);

    const Location = await requestLocationPermission();
    if (!Location) {
      setIsBusy(false);
      return;
    }

    try {
      const servicesEnabled = await Location.hasServicesEnabledAsync();
      if (!servicesEnabled) {
        Alert.alert('Location required', 'Please enable location services (GPS)');
        setIsBusy(false);
        return;
      }

      await enableHighAccuracyProviderIfAvailable(Location);

      resetRunState();
      runStartedAtRef.current = Date.now();
      runStartedTimestampRef.current = Date.now();

      await startStepTracking();

      try {
        const current = await getBestInitialFix(Location);
        if (!current) {
          throw new Error('No initial GPS fix');
        }

        const initialAccuracy = getAccuracyMeters(current.coords);
        if (initialAccuracy !== null && initialAccuracy > MAX_LOCATION_ACCURACY_M) {
          throw new Error('Initial accuracy is too low');
        }

        const initialPoint = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };

        setLocation(initialPoint);
        setCoords([initialPoint]);
        const initialTimestamp = Number(current.timestamp);
        lastAcceptedPointRef.current = initialPoint;
        lastAcceptedTimestampRef.current = Number.isFinite(initialTimestamp)
          ? initialTimestamp
          : Date.now();
        focusMapOnPoint(initialPoint, 650);

        const speedMs = Number(current.coords.speed);
        if (Number.isFinite(speedMs) && speedMs > 0) {
          setInstantSpeedKmh(speedMs * 3.6);
        }

        const altitude = Number(current.coords.altitude);
        if (Number.isFinite(altitude)) {
          lastAltitudeRef.current = altitude;
        }
      } catch (error) {
        // If initial GPS fix fails, watchPositionAsync will still attempt updates.
      }

      startTimer();

      watcherRef.current = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 1000,
          distanceInterval: 1,
          mayShowUserSettingsDialog: true,
        },
        loc => {
          const latitude = Number(loc.coords.latitude);
          const longitude = Number(loc.coords.longitude);
          if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
            return;
          }

          const signalAccuracy = getAccuracyMeters(loc.coords);
          if (signalAccuracy !== null && signalAccuracy > MAX_LOCATION_ACCURACY_M) {
            return;
          }

          const point = {
            latitude,
            longitude,
          };

          const rawTimestamp = Number(loc.timestamp);
          const pointTimestamp = Number.isFinite(rawTimestamp) ? rawTimestamp : Date.now();
          const lastPoint = lastAcceptedPointRef.current;

          if (!lastPoint) {
            setCoords([point]);
            lastAcceptedPointRef.current = point;
            lastAcceptedTimestampRef.current = pointTimestamp;
          } else {
            const segment = distanceKmBetween(lastPoint, point);
            if (segment > MAX_SEGMENT_KM) {
              return;
            }

            if (segment >= MIN_SEGMENT_KM) {
              const previousAcceptedPoint = lastPoint;
              const lastTimestamp = lastAcceptedTimestampRef.current;
              if (Number.isFinite(lastTimestamp) && pointTimestamp > lastTimestamp) {
                const elapsedHours = (pointTimestamp - lastTimestamp) / 3600000;
                const inferredSpeedKmh = elapsedHours > 0 ? segment / elapsedHours : 0;
                if (inferredSpeedKmh > MAX_PLAUSIBLE_RUNNING_SPEED_KMH) {
                  return;
                }
              }

              setDistance(previousDistance => previousDistance + segment);
              setCoords(prev =>
                prev.length === 0 && previousAcceptedPoint
                  ? [previousAcceptedPoint, point]
                  : [...prev, point]
              );
              lastAcceptedPointRef.current = point;
              lastAcceptedTimestampRef.current = pointTimestamp;
            }
          }

          setLocation(point);

          const speedMs = Number(loc.coords.speed);
          if (Number.isFinite(speedMs) && speedMs > 0) {
            setInstantSpeedKmh(speedMs * 3.6);
          } else {
            setInstantSpeedKmh(0);
          }

          const altitude = Number(loc.coords.altitude);
          if (Number.isFinite(altitude)) {
            if (Number.isFinite(lastAltitudeRef.current)) {
              const gain = altitude - lastAltitudeRef.current;
              if (gain > 0 && gain < 4) {
                setElevationGainM(prev => prev + gain);
              }
            }
            lastAltitudeRef.current = altitude;
          }
        }
      );

      setIsRunning(true);
    } catch (error) {
      stopLocationTracking();
      stopStepTracking();
      stopTimer();
      resetRunState();
      Alert.alert('Error', 'Unable to start location tracking');
    } finally {
      setIsBusy(false);
    }
  };

  const captureMapSnapshot = async () => {
    if (!MAP_ENABLED || !MapView || !mapCaptureRef.current) return null;

    try {
      await fitMapToRoute();

      const { captureRef } = require('react-native-view-shot');
      const tempUri = await captureRef(mapCaptureRef.current, {
        format: 'jpg',
        quality: 0.9,
      });

      const filename = `run-map-${Date.now()}.jpg`;
      const outputUri = FileSystem.documentDirectory + filename;
      await FileSystem.moveAsync({ from: tempUri, to: outputUri });
      return outputUri;
    } catch (error) {
      return null;
    }
  };

  const stopRun = async () => {
    if (isBusy || !isRunning) return;

    setIsBusy(true);
    setIsRunning(false);

    stopLocationTracking();
    stopStepTracking();

    const runSeconds = stopTimer();
    const normalizedDistance = Number(distance.toFixed(2));

    if (runSeconds < MIN_SAVE_SECONDS || normalizedDistance < MIN_SAVE_DISTANCE_KM) {
      Alert.alert(
        'Run not saved',
        `Run must be at least ${MIN_SAVE_SECONDS} seconds and ${MIN_SAVE_DISTANCE_KM} km.`
      );
      resetRunState();
      setIsBusy(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'You are not logged in');
        resetRunState();
        setIsBusy(false);
        return;
      }

      const mapImage = await captureMapSnapshot();
      const snapshotSteps = usingSensorSteps ? stepCount : estimateSteps(normalizedDistance);
      const snapshotAvgSpeed = normalizedDistance / (runSeconds / 3600);

      const runData = {
        time: runSeconds,
        distance: normalizedDistance,
        pace: formatPace(runSeconds, normalizedDistance),
        route: coords,
        mapImage,
        steps: snapshotSteps,
        stepSource: usingSensorSteps ? 'sensor' : 'estimated',
        averageSpeedKmh: Number(snapshotAvgSpeed.toFixed(2)),
        elevationGainM: Number(elevationGainM.toFixed(1)),
        calories,
        createdAt: Date.now(),
        startedAt: runStartedTimestampRef.current || Date.now() - runSeconds * 1000,
        endedAt: Date.now(),
      };

      const runRef = push(ref(database, `users/${uid || user.uid}/runs`));
      await set(runRef, runData);

      Alert.alert('Success', 'Run saved');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save run');
    } finally {
      resetRunState();
      setIsBusy(false);
    }
  };

  const pace = formatPace(seconds, distance);
  const statusText = isBusy
    ? 'Preparing session...'
    : isRunning
      ? 'Tracking live'
      : hasLocationPermission === false
        ? 'Location permission required'
        : 'Ready to run';

  const buttonText = isBusy
    ? 'WORKING...'
    : isRunning
      ? 'STOP & SAVE'
      : 'START RUN';

  const mapMessage = !MAP_ENABLED
    ? 'Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env and rebuild to enable map.'
    : 'react-native-maps is unavailable in this build.';

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={gradients.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.glowA} />
      <View style={styles.glowB} />

      <View style={styles.headerRow}>
        <Text style={styles.header}>Run Session</Text>
        <View style={styles.statusChip}>
          <Text style={styles.statusChipText}>{statusText}</Text>
        </View>
      </View>

      <View style={styles.heroCard}>
        <Text style={styles.time}>{formatClock(seconds)}</Text>
        <View style={styles.row}>
          <Stat value={distance.toFixed(2)} label="Distance (km)" />
          <Stat value={pace} label="Pace (/km)" />
          <Stat value={formatNumber(displaySpeedKmh, 1)} label="Speed" />
        </View>
      </View>

      <View style={styles.metricsRow}>
        <MiniStat label={usingSensorSteps ? 'Steps' : 'Est. Steps'} value={totalSteps.toLocaleString()} />
        <MiniStat label="Cadence" value={`${cadenceSpm} spm`} />
        <MiniStat label="Calories" value={`${calories} kcal`} />
        <MiniStat label="Elev Gain" value={`${Math.round(elevationGainM)} m`} />
      </View>

      <View style={styles.mapCard} ref={mapCaptureRef} collapsable={false}>
        {MAP_ENABLED && MapView ? (
          <MapView
            ref={mapViewRef}
            style={StyleSheet.absoluteFill}
            initialRegion={DEFAULT_REGION}
            showsUserLocation={hasLocationPermission === true}
            showsMyLocationButton
            showsCompass
          >
            {coords.length > 0 && Marker ? (
              <Marker coordinate={coords[0]} pinColor="#34d399" title="Start" />
            ) : null}

            {location && Marker ? (
              <Marker coordinate={location} pinColor="#f97316" title="Current" />
            ) : null}

            {Polyline && coords.length > 1 ? (
              <Polyline coordinates={coords} strokeWidth={6} strokeColor="#f97316" />
            ) : null}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderTitle}>Map Preview Disabled</Text>
            <Text style={styles.mapPlaceholderText}>{mapMessage}</Text>
          </View>
        )}
      </View>

      <Pressable
        style={[styles.actionButton, isBusy && styles.actionButtonDisabled]}
        onPress={isRunning ? stopRun : startRun}
        disabled={isBusy}
      >
        <LinearGradient
          colors={isRunning ? gradients.dangerButton : gradients.successButton}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.actionButtonGradient}
        >
          <Text style={styles.actionText}>{buttonText}</Text>
        </LinearGradient>
      </Pressable>

      <BottomTab navigation={navigation} uid={uid} active="Run" />
    </SafeAreaView>
  );
}

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function MiniStat({ value, label }) {
  return (
    <View style={styles.miniStatCard}>
      <Text style={styles.miniStatValue}>{value}</Text>
      <Text style={styles.miniStatLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bgBase,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.screenTop,
    paddingBottom: 92,
  },
  glowA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(34,197,94,0.18)',
    top: -60,
    right: -40,
  },
  glowB: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(249,115,22,0.16)',
    bottom: 120,
    left: -50,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  header: {
    ...typography.section,
    fontSize: 22,
  },
  statusChip: {
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statusChipText: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '600',
  },
  heroCard: {
    backgroundColor: 'rgba(15,23,42,0.75)',
    borderRadius: radii.lg,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    ...shadows.light,
  },
  time: {
    color: palette.textPrimary,
    fontSize: 44,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  stat: {
    flex: 1,
    alignItems: 'center',
  },
  value: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '700',
  },
  label: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  metricsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginTop: 12,
    marginBottom: 12,
    rowGap: 8,
  },
  miniStatCard: {
    width: '48.5%',
    backgroundColor: 'rgba(15,23,42,0.7)',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  miniStatValue: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
  miniStatLabel: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 2,
  },
  mapCard: {
    flex: 1,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgDeep,
    ...shadows.light,
    marginBottom: 14,
  },
  mapPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  mapPlaceholderTitle: {
    color: palette.textPrimary,
    fontSize: 16,
    fontWeight: '700',
    marginBottom: 8,
  },
  mapPlaceholderText: {
    color: palette.textMuted,
    textAlign: 'center',
  },
  actionButton: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginBottom: 8,
    ...shadows.light,
  },
  actionButtonGradient: {
    paddingVertical: 15,
    alignItems: 'center',
  },
  actionButtonDisabled: {
    opacity: 0.72,
  },
  actionText: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
});
