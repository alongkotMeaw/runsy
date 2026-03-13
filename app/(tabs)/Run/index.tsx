// @ts-nocheck
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  Alert,
  AppState,
  Platform,
  ScrollView,
  useWindowDimensions,
} from 'react-native';
import { usePathname } from 'expo-router';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { Pedometer } from 'expo-sensors';
import * as Location from 'expo-location';
import * as FileSystem from 'expo-file-system/legacy';

import BottomTab from '../../../components/BottomTab';
import { withLegacyRoute } from '../../createLegacyRoute';

/* Firebase */
import { auth, database } from '../../../firebaseConfig';
import { ref, push, set, get } from 'firebase/database';
import {
  clearRunTrackingSession,
  getRunTrackingSession,
  requestRunTrackingPermissions,
  startRunTracking,
  stopRunTracking,
} from '../../../services/runTrackingService';
import {
  gradients,
  palette,
  radii,
  shadows,
  spacing,
  surfaces,
  typography,
} from '../../../theme/premiumTheme';

/* ---------- Utils ---------- */
const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
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
const MIN_LIVE_PACE_DISTANCE_KM = 0.05;
const SNAP_PADDING = { top: 48, right: 48, bottom: 48, left: 48 };
const DEFAULT_WEIGHT_KG = 65;
const KCAL_PER_KM_PER_KG = 1.036;
const SESSION_SYNC_MS = 1100;

/* ---------- Screen ---------- */
function RunScreen({ navigation, route }) {
  const uid = route?.params?.uid || auth.currentUser?.uid;
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const isFocused = pathname.startsWith('/Run');
  const { height: windowHeight } = useWindowDimensions();

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
  const syncRef = useRef(null);
  const pedometerSubRef = useRef(null);
  const runStartedAtRef = useRef(null);
  const runStartedTimestampRef = useRef(null);
  const mapCaptureRef = useRef(null);
  const mapViewRef = useRef(null);
  const appStateRef = useRef(AppState.currentState);

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
  const isLiveMode = isRunning && !isBusy;
  const isSessionExpanded = isRunning || isBusy;
  const isCompactScreen = windowHeight < 820;
  const isShortScreen = windowHeight < 740;
  const bottomTabPadding = Math.max(8, insets.bottom + 2);
  const bottomTabHeight = 64 + bottomTabPadding;
  const preRunMapMinHeight = isShortScreen ? 172 : isCompactScreen ? 196 : 250;
  const liveMapMinHeight = isShortScreen ? 280 : isCompactScreen ? 320 : 360;
  const shouldKeepScreenAwake = isFocused && (isRunning || isBusy);

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
      stopStepTracking();

      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (syncRef.current) {
        clearInterval(syncRef.current);
        syncRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const keepAwakeTag = 'runsy-run-session';

    if (!shouldKeepScreenAwake) {
      deactivateKeepAwake(keepAwakeTag).catch(() => {});
      return;
    }

    activateKeepAwakeAsync(keepAwakeTag).catch(() => {});

    return () => {
      deactivateKeepAwake(keepAwakeTag).catch(() => {});
    };
  }, [shouldKeepScreenAwake]);

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

  const syncTrackingSessionToUi = useCallback(async () => {
    const session = await getRunTrackingSession();
    if (!session?.active) return null;

    const startedAt = toNumber(session.startedAt, 0);
    if (startedAt > 0) {
      runStartedAtRef.current = startedAt;
      runStartedTimestampRef.current = startedAt;
      setSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
    }

    const nextDistanceKm = toNumber(session.distanceKm, 0);
    const nextElevation = toNumber(session.elevationGainM, 0);
    const nextSpeed = toNumber(session.lastSpeedKmh, 0);
    const nextCoords = Array.isArray(session.coords) ? session.coords : [];
    const nextPoint = session.currentPoint || nextCoords[nextCoords.length - 1] || null;

    setDistance(nextDistanceKm);
    setElevationGainM(nextElevation);
    setInstantSpeedKmh(nextSpeed);
    setCoords(nextCoords);
    setLocation(nextPoint);

    return session;
  }, []);

  useEffect(() => {
    let mounted = true;

    const restoreRunningSession = async () => {
      const session = await getRunTrackingSession();
      if (!mounted || !session?.active) return;

      setIsRunning(true);
      const syncedSession = await syncTrackingSessionToUi();
      startTimer();
      await startStepTracking();

      const routeCoords = Array.isArray(syncedSession?.coords) ? syncedSession.coords : [];
      const currentPoint = syncedSession?.currentPoint || routeCoords[routeCoords.length - 1] || null;
      if (routeCoords.length > 1) {
        await fitMapToRoute(routeCoords, currentPoint);
      } else if (currentPoint) {
        focusMapOnPoint(currentPoint, 0);
      }
    };

    restoreRunningSession();

    return () => {
      mounted = false;
    };
  }, [syncTrackingSessionToUi]);

  useEffect(() => {
    if (!isRunning) {
      if (syncRef.current) {
        clearInterval(syncRef.current);
        syncRef.current = null;
      }
      return;
    }

    syncTrackingSessionToUi();
    syncRef.current = setInterval(() => {
      syncTrackingSessionToUi();
    }, SESSION_SYNC_MS);

    return () => {
      if (syncRef.current) {
        clearInterval(syncRef.current);
        syncRef.current = null;
      }
    };
  }, [isRunning, syncTrackingSessionToUi]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', nextState => {
      const wasBackground =
        appStateRef.current === 'background' || appStateRef.current === 'inactive';
      appStateRef.current = nextState;

      if (wasBackground && nextState === 'active' && isRunning) {
        (async () => {
          const session = await syncTrackingSessionToUi();
          const routeCoords = Array.isArray(session?.coords) ? session.coords : [];
          const currentPoint = session?.currentPoint || routeCoords[routeCoords.length - 1] || null;

          if (routeCoords.length > 1) {
            await fitMapToRoute(routeCoords, currentPoint);
            return;
          }

          if (currentPoint) {
            focusMapOnPoint(currentPoint, 450);
          }
        })();
      }
    });

    return () => subscription.remove();
  }, [isRunning, syncTrackingSessionToUi]);

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

  const fitMapToRoute = async (routeCoords = coords, focusLocation = location) => {
    if (!mapViewRef.current) return;

    if (routeCoords.length > 1 && typeof mapViewRef.current.fitToCoordinates === 'function') {
      mapViewRef.current.fitToCoordinates(routeCoords, {
        edgePadding: SNAP_PADDING,
        animated: false,
      });
      await wait(420);
      return;
    }

    if (focusLocation) {
      focusMapOnPoint(focusLocation, 0);
      await wait(300);
    }
  };

  const requestLocationPermission = async () => {
    try {
      const permission = await requestRunTrackingPermissions();
      setHasLocationPermission(permission.foregroundGranted);

      if (!permission.foregroundGranted) {
        Alert.alert('Location required', 'Please allow location permission');
        return false;
      }

      return true;
    } catch (error) {
      setHasLocationPermission(false);
      Alert.alert('Error', error?.message || 'Unable to request location permission');
      return false;
    }
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

    const permissionGranted = await requestLocationPermission();
    if (!permissionGranted) {
      setIsBusy(false);
      return;
    }

    try {
      await clearRunTrackingSession();
      resetRunState();

      const startedAt = Date.now();
      runStartedAtRef.current = startedAt;
      runStartedTimestampRef.current = startedAt;

      await startStepTracking();

      let current = null;
      try {
        current = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Highest,
        });

        const initialPoint = {
          latitude: current.coords.latitude,
          longitude: current.coords.longitude,
        };

        setLocation(initialPoint);
        setCoords([initialPoint]);
        focusMapOnPoint(initialPoint, 650);

        const speedMs = toNumber(current.coords.speed, NaN);
        if (Number.isFinite(speedMs) && speedMs > 0) {
          setInstantSpeedKmh(speedMs * 3.6);
        }
      } catch (error) {
        // Continue even if the first GPS fix is still pending.
      }

      await startRunTracking({
        startedAt,
        seedLocation: current,
      });

      startTimer();
      setIsRunning(true);
      await syncTrackingSessionToUi();
    } catch (error) {
      stopStepTracking();
      stopTimer();
      await clearRunTrackingSession();
      resetRunState();
      Alert.alert('Error', 'Unable to start location tracking');
    } finally {
      setIsBusy(false);
    }
  };

  const captureMapSnapshot = async (routeCoords = coords, focusLocation = location) => {
    if (!MAP_ENABLED || !MapView || !mapCaptureRef.current) return null;

    try {
      await fitMapToRoute(routeCoords, focusLocation);

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

    stopStepTracking();
    const runSeconds = stopTimer();

    let trackedSession = null;
    try {
      trackedSession = await stopRunTracking();
    } catch (error) {
      trackedSession = await getRunTrackingSession();
    }

    const trackedDistanceKm = toNumber(trackedSession?.distanceKm, NaN);
    const finalDistanceKm = Number.isFinite(trackedDistanceKm) ? trackedDistanceKm : toNumber(distance, 0);
    const roundedDistanceKm = Number(finalDistanceKm.toFixed(3));
    const trackedRoute = Array.isArray(trackedSession?.coords) ? trackedSession.coords : [];
    const finalRoute = trackedRoute.length > 0 ? trackedRoute : coords;
    const finalPoint = trackedSession?.currentPoint || finalRoute[finalRoute.length - 1] || location;
    const trackedElevationGainM = toNumber(trackedSession?.elevationGainM, NaN);
    const finalElevationGainM = Number.isFinite(trackedElevationGainM)
      ? trackedElevationGainM
      : toNumber(elevationGainM, 0);
    const finalCalories = Math.max(0, Math.round(finalDistanceKm * userWeightKg * KCAL_PER_KM_PER_KG));

    setDistance(finalDistanceKm);
    setCoords(finalRoute);
    setLocation(finalPoint);
    setElevationGainM(finalElevationGainM);
    setInstantSpeedKmh(toNumber(trackedSession?.lastSpeedKmh, 0));

    if (runSeconds < MIN_SAVE_SECONDS || finalDistanceKm < MIN_SAVE_DISTANCE_KM) {
      Alert.alert(
        'Run not saved',
        `Run must be at least ${MIN_SAVE_SECONDS} seconds and ${MIN_SAVE_DISTANCE_KM} km.`
      );
      await clearRunTrackingSession();
      resetRunState();
      setIsBusy(false);
      return;
    }

    try {
      const user = auth.currentUser;
      if (!user) {
        Alert.alert('Error', 'You are not logged in');
        await clearRunTrackingSession();
        resetRunState();
        setIsBusy(false);
        return;
      }

      const mapImage = await captureMapSnapshot(finalRoute, finalPoint);
      const snapshotSteps = usingSensorSteps ? stepCount : estimateSteps(finalDistanceKm);
      const snapshotAvgSpeed = finalDistanceKm / (runSeconds / 3600);

      const runData = {
        time: runSeconds,
        distance: roundedDistanceKm,
        pace: formatPace(runSeconds, finalDistanceKm),
        route: finalRoute,
        mapImage,
        steps: snapshotSteps,
        stepSource: usingSensorSteps ? 'sensor' : 'estimated',
        averageSpeedKmh: Number(snapshotAvgSpeed.toFixed(2)),
        elevationGainM: Number(finalElevationGainM.toFixed(1)),
        calories: finalCalories,
        createdAt: Date.now(),
        startedAt: toNumber(
          trackedSession?.startedAt,
          runStartedTimestampRef.current || Date.now() - runSeconds * 1000
        ),
        endedAt: Date.now(),
      };

      const runRef = push(ref(database, `users/${uid || user.uid}/runs`));
      await set(runRef, runData);

      Alert.alert('Success', 'Run saved');
    } catch (error) {
      Alert.alert('Error', error.message || 'Failed to save run');
    } finally {
      await clearRunTrackingSession();
      resetRunState();
      setIsBusy(false);
    }
  };

  const pace =
    distance >= MIN_LIVE_PACE_DISTANCE_KM
      ? formatPace(seconds, distance)
      : '--';
  const statusText = isBusy
    ? 'Preparing session...'
    : isRunning
      ? 'Live tracking active'
      : hasLocationPermission === false
        ? 'Location permission required'
        : 'Ready to run';

  const buttonText = isBusy
    ? 'WORKING...'
    : isRunning
      ? 'STOP & SAVE'
      : 'START RUN';
  const mapPanelTitle = isLiveMode ? 'LIVE ROUTE' : 'ROUTE PREVIEW';
  const mapPanelStatus = !MAP_ENABLED || !MapView
    ? 'Map unavailable'
    : isLiveMode
      ? coords.length > 1
        ? `${coords.length} points tracked`
        : 'Waiting for first GPS point'
      : 'Ready when you start';

  const mapMessage = !MAP_ENABLED
    ? 'Add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY in .env and rebuild to enable map.'
    : 'react-native-maps is unavailable in this build.';

  const actionButtonNode = (
    <Pressable
      style={[
        styles.actionButton,
        isBusy && styles.actionButtonDisabled,
        isLiveMode && styles.actionButtonLive,
        isSessionExpanded && styles.actionButtonExpanded,
        !isSessionExpanded && styles.actionButtonDocked,
      ]}
      onPress={isRunning ? stopRun : startRun}
      disabled={isBusy}
    >
      <LinearGradient
        colors={isRunning ? gradients.dangerButton : gradients.accentButton}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.actionButtonGradient}
      >
        <Text style={styles.actionText}>{buttonText}</Text>
      </LinearGradient>
    </Pressable>
  );

  const screenContent = (
    <>
      {!isSessionExpanded ? (
        <View style={styles.headerRow}>
          <Text style={styles.header}>Run Session</Text>
          <View style={[styles.statusChip, isLiveMode && styles.statusChipLive]}>
            <Text style={[styles.statusChipText, isLiveMode && styles.statusChipTextLive]}>
              {statusText}
            </Text>
          </View>
        </View>
      ) : null}

      <LinearGradient
        colors={gradients.hero}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.heroCard,
          isLiveMode && styles.heroCardLive,
          isCompactScreen && styles.heroCardCompact,
        ]}
      >
        {!isLiveMode ? (
          <View style={styles.heroTopRow}>
            <Text style={styles.preRunHint}>Tap start to begin your run</Text>
          </View>
        ) : null}

        <Text style={[styles.time, isCompactScreen && styles.timeCompact]}>{formatClock(seconds)}</Text>
        <View style={styles.row}>
          <Stat value={distance.toFixed(2)} label="Distance (km)" />
          <Stat value={pace} label="Pace (/km)" />
          <Stat value={formatNumber(displaySpeedKmh, 1)} label="Speed" />
        </View>
      </LinearGradient>

      <View style={[styles.metricsRow, isCompactScreen && styles.metricsRowCompact]}>
        <MiniStat
          label={usingSensorSteps ? 'Steps' : 'Est. Steps'}
          value={totalSteps.toLocaleString()}
          icon="walk-outline"
          tintColor="#34d399"
          compact={isCompactScreen}
        />
        <MiniStat
          label="Cadence"
          value={`${cadenceSpm} spm`}
          icon="timer-outline"
          tintColor="#38bdf8"
          compact={isCompactScreen}
        />
        <MiniStat
          label="Calories"
          value={`${calories} kcal`}
          icon="flame-outline"
          tintColor="#fb7185"
          compact={isCompactScreen}
        />
        <MiniStat
          label="Elev Gain"
          value={`${Math.round(elevationGainM)} m`}
          icon="trending-up-outline"
          tintColor="#f59e0b"
          compact={isCompactScreen}
        />
      </View>

      <View
        style={[
          styles.mapCard,
          !isSessionExpanded && styles.mapCardStatic,
          isLiveMode && styles.mapCardLive,
          isSessionExpanded && styles.mapCardExpanded,
          !isSessionExpanded && { minHeight: preRunMapMinHeight },
          isSessionExpanded && { minHeight: liveMapMinHeight },
        ]}
        ref={mapCaptureRef}
        collapsable={false}
      >
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
              <Polyline coordinates={coords} strokeWidth={6} strokeColor={isLiveMode ? '#22c55e' : '#f97316'} />
            ) : null}
          </MapView>
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapPlaceholderTitle}>Map Preview Disabled</Text>
            <Text style={styles.mapPlaceholderText}>{mapMessage}</Text>
          </View>
        )}

        <View pointerEvents="none" style={styles.mapOverlay}>
          <LinearGradient
            colors={['rgba(6,11,20,0.84)', 'rgba(6,11,20,0.34)', 'transparent']}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={styles.mapOverlayFade}
          />
          <View style={styles.mapOverlayRow}>
            <View style={[styles.mapOverlayBadge, isLiveMode && styles.mapOverlayBadgeLive]}>
              <Text style={styles.mapOverlayBadgeText}>{mapPanelTitle}</Text>
            </View>
            <View style={styles.mapOverlayInfo}>
              <Text style={styles.mapOverlayInfoText}>{mapPanelStatus}</Text>
            </View>
          </View>
        </View>
      </View>

      <View style={styles.actionButtonInlineWrap}>{actionButtonNode}</View>
    </>
  );

  return (
    <SafeAreaView style={[styles.container, isSessionExpanded && styles.containerExpanded]}>
      <LinearGradient
        colors={gradients.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.glowA, isLiveMode && styles.glowAlive]} />
      <View style={[styles.glowB, isLiveMode && styles.glowBLive]} />

      {isSessionExpanded ? (
        <ScrollView
          contentContainerStyle={[styles.scrollContent, styles.expandedScrollContent, { paddingBottom: Math.max(20, insets.bottom + 18) }]}
          showsVerticalScrollIndicator={false}
        >
          {screenContent}
        </ScrollView>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomTabHeight + 28 }]}
            showsVerticalScrollIndicator={false}
          >
            {screenContent}
          </ScrollView>
          <BottomTab navigation={navigation} uid={uid} active="Run" />
        </>
      )}
    </SafeAreaView>
  );
}

export default withLegacyRoute(RunScreen);

function Stat({ value, label }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </View>
  );
}

function MiniStat({ value, label, icon, tintColor, compact = false }) {
  return (
    <View style={[styles.miniStatCard, compact && styles.miniStatCardCompact]}>
      <View style={styles.miniStatTop}>
        <View style={[styles.miniStatIconWrap, compact && styles.miniStatIconWrapCompact, { backgroundColor: `${tintColor}22` }]}>
          <Ionicons name={icon} size={16} color={tintColor} />
        </View>
        <Text style={[styles.miniStatLabel, compact && styles.miniStatLabelCompact]}>{label}</Text>
      </View>
      <Text style={[styles.miniStatValue, compact && styles.miniStatValueCompact]}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bgBase,
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.screenTop,
    paddingBottom: 0,
  },
  containerExpanded: {
    paddingBottom: 16,
  },
  scrollContent: {
    paddingBottom: 16,
  },
  expandedContent: {
    flex: 1,
  },
  expandedScrollContent: {
    flexGrow: 1,
  },
  actionDock: {
    position: 'absolute',
    left: spacing.screenHorizontal,
    right: spacing.screenHorizontal,
  },
  glowA: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(34,197,94,0.14)',
    top: -72,
    right: -40,
  },
  glowAlive: {
    backgroundColor: 'rgba(34,197,94,0.18)',
    top: -68,
    right: -28,
  },
  glowB: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(249,115,22,0.14)',
    bottom: 120,
    left: -50,
  },
  glowBLive: {
    backgroundColor: 'rgba(249,115,22,0.16)',
    bottom: 128,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  header: {
    ...typography.title,
    fontSize: 28,
  },
  statusChip: {
    backgroundColor: 'rgba(13,22,39,0.82)',
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  statusChipLive: {
    backgroundColor: 'rgba(13,22,39,0.88)',
    borderColor: 'rgba(74,222,128,0.26)',
  },
  statusChipText: {
    color: palette.textSecondary,
    fontSize: 11,
    fontWeight: '700',
  },
  statusChipTextLive: {
    color: palette.textPrimary,
  },
  heroCard: {
    borderRadius: radii.lg,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    overflow: 'hidden',
    ...shadows.light,
  },
  heroCardCompact: {
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  heroCardLive: {
    borderColor: 'rgba(74,222,128,0.3)',
  },
  heroTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 24,
  },
  preRunHint: {
    color: palette.textSecondary,
    fontSize: 12,
  },
  time: {
    color: palette.textPrimary,
    fontSize: 44,
    fontWeight: '800',
    textAlign: 'center',
    letterSpacing: 1,
    marginBottom: 8,
    marginTop: 6,
  },
  timeCompact: {
    fontSize: 40,
    marginBottom: 6,
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
    marginTop: 14,
    marginBottom: 14,
    rowGap: 10,
  },
  metricsRowCompact: {
    marginTop: 10,
    marginBottom: 10,
    rowGap: 8,
  },
  miniStatCard: {
    width: '48.6%',
    minHeight: 88,
    justifyContent: 'space-between',
    ...surfaces.card,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...shadows.light,
  },
  miniStatCardCompact: {
    minHeight: 76,
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  miniStatTop: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  miniStatIconWrap: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    marginRight: 8,
  },
  miniStatIconWrapCompact: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 6,
  },
  miniStatValue: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '800',
    marginTop: 12,
  },
  miniStatValueCompact: {
    fontSize: 19,
    marginTop: 10,
  },
  miniStatLabel: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    flex: 1,
  },
  miniStatLabelCompact: {
    fontSize: 9,
  },
  mapCard: {
    flex: 1,
    minHeight: 250,
    borderRadius: radii.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: palette.bgDeep,
    ...shadows.light,
    marginBottom: 16,
  },
  mapCardStatic: {
    flex: 0,
    marginBottom: 0,
  },
  mapCardLive: {
    borderColor: 'rgba(74,222,128,0.26)',
  },
  mapCardExpanded: {
    minHeight: 360,
  },
  mapOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    padding: 12,
    zIndex: 1,
  },
  mapOverlayFade: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 88,
  },
  mapOverlayRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapOverlayBadge: {
    backgroundColor: 'rgba(8,17,32,0.8)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.2)',
  },
  mapOverlayBadgeLive: {
    backgroundColor: 'rgba(8,17,32,0.82)',
    borderColor: 'rgba(74,222,128,0.26)',
  },
  mapOverlayBadgeText: {
    color: palette.textPrimary,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.75,
  },
  mapOverlayInfo: {
    maxWidth: '58%',
    backgroundColor: 'rgba(8,17,32,0.72)',
    borderRadius: radii.pill,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
  },
  mapOverlayInfoText: {
    color: palette.textSecondary,
    fontSize: 10,
    fontWeight: '600',
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
  actionButtonInlineWrap: {
    marginBottom: 4,
  },
  actionButton: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: 14,
    marginBottom: 0,
    ...shadows.light,
  },
  actionButtonDocked: {
    marginBottom: 0,
  },
  actionButtonExpanded: {
    marginBottom: 0,
  },
  actionButtonLive: {
    shadowColor: '#ef4444',
    shadowOpacity: 0.24,
    shadowRadius: 12,
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
