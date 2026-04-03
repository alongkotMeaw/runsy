import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export const RUN_TRACKING_TASK_NAME = 'runsy-background-location-task';

const RUN_TRACKING_SESSION_KEY = '@runsy/run-tracking-session-v1';
const MIN_SEGMENT_KM = 0.003;
const MAX_DIRECT_SEGMENT_KM = 0.3;
const MAX_SEGMENT_KM = 2.5;
const MAX_COORD_POINTS = 12000;
const MAX_POINT_ACCURACY_M = 80;
const MAX_REASONABLE_SPEED_KMH = 35;
const NOTIFICATION_REFRESH_MS = 15000;

const toNumber = (value, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const toRad = value => (value * Math.PI) / 180;

const distanceKmBetween = (a, b) => {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const lat1 = toRad(a.latitude);
  const lat2 = toRad(b.latitude);

  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;

  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
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

const toPoint = location => {
  const latitude = toNumber(location?.coords?.latitude, NaN);
  const longitude = toNumber(location?.coords?.longitude, NaN);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude };
};

const createSession = startedAt => ({
  active: true,
  startedAt: toNumber(startedAt, Date.now()),
  updatedAt: Date.now(),
  distanceKm: 0,
  elevationGainM: 0,
  lastSpeedKmh: 0,
  lastAltitude: null,
  lastPoint: null,
  lastTimestamp: null,
  currentPoint: null,
  coords: [],
  notificationUpdatedAt: 0,
});

const getNotificationBody = session => {
  const distanceKm = Math.max(0, toNumber(session?.distanceKm, 0));
  const startedAt = toNumber(session?.startedAt, Date.now());
  const elapsedSeconds = Math.max(0, Math.floor((Date.now() - startedAt) / 1000));

  return `${distanceKm.toFixed(2)} km - ${formatClock(elapsedSeconds)}`;
};

const buildLocationOptions = session => {
  const options = {
    accuracy: Location.Accuracy.High,
    timeInterval: 1000,
    distanceInterval: 3,
    pausesUpdatesAutomatically: false,
    deferredUpdatesInterval: 1000,
    deferredUpdatesDistance: 0,
  };

  if (Platform.OS === 'android') {
    options.foregroundService = {
      notificationTitle: 'Runsy is tracking your run',
      notificationBody: getNotificationBody(session),
      notificationColor: '#16a34a',
      killServiceOnDestroy: false,
    };
  }

  if (Platform.OS === 'ios') {
    options.activityType = Location.ActivityType.Fitness;
    options.showsBackgroundLocationIndicator = true;
  }

  return options;
};

const appendLocationToSession = (session, location) => {
  const point = toPoint(location);
  if (!point) return session;

  const accuracyM = toNumber(location?.coords?.accuracy, NaN);

  let distanceKm = toNumber(session.distanceKm, 0);
  let coords = Array.isArray(session.coords) ? session.coords : [];
  let lastPoint = session.lastPoint || null;
  let lastTimestamp = toNumber(session.lastTimestamp, 0);
  const currentTimestamp = toNumber(location?.timestamp, Date.now());

  if (!lastPoint) {
    coords = [...coords, point];
    lastPoint = point;
    lastTimestamp = currentTimestamp;
  } else {
    const segmentKm = distanceKmBetween(lastPoint, point);
    const elapsedSeconds = lastTimestamp > 0 ? Math.max(0, (currentTimestamp - lastTimestamp) / 1000) : 0;
    const impliedSpeedKmh =
      elapsedSeconds > 0 ? segmentKm / (elapsedSeconds / 3600) : 0;
    const speedIsReasonable =
      elapsedSeconds <= 0 || impliedSpeedKmh <= MAX_REASONABLE_SPEED_KMH;
    const longSegmentAccuracyOk =
      segmentKm <= MAX_DIRECT_SEGMENT_KM ||
      !Number.isFinite(accuracyM) ||
      accuracyM <= MAX_POINT_ACCURACY_M;

    if (
      segmentKm >= MIN_SEGMENT_KM &&
      segmentKm <= MAX_SEGMENT_KM &&
      speedIsReasonable &&
      longSegmentAccuracyOk
    ) {
      distanceKm += segmentKm;
      coords = [...coords, point];
      lastPoint = point;
      lastTimestamp = currentTimestamp;
    }
  }

  if (coords.length > MAX_COORD_POINTS) {
    coords = coords.slice(coords.length - MAX_COORD_POINTS);
  }

  const altitude = toNumber(location?.coords?.altitude, NaN);
  const previousAltitude = toNumber(session.lastAltitude, NaN);
  let elevationGainM = toNumber(session.elevationGainM, 0);
  let lastAltitude = session.lastAltitude ?? null;

  if (Number.isFinite(altitude)) {
    if (Number.isFinite(previousAltitude)) {
      const gain = altitude - previousAltitude;
      if (gain > 0 && gain < 4) {
        elevationGainM += gain;
      }
    }
    lastAltitude = altitude;
  }

  const speedMs = toNumber(location?.coords?.speed, NaN);
  const lastSpeedKmh = Number.isFinite(speedMs) && speedMs > 0 ? speedMs * 3.6 : 0;

  return {
    ...session,
    distanceKm,
    elevationGainM,
    lastAltitude,
    lastPoint,
    lastTimestamp: lastTimestamp || session.lastTimestamp || null,
    currentPoint: point,
    coords,
    lastSpeedKmh,
    updatedAt: Date.now(),
  };
};

const readSession = async () => {
  try {
    const raw = await AsyncStorage.getItem(RUN_TRACKING_SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (error) {
    return null;
  }
};

const writeSession = async session => {
  try {
    await AsyncStorage.setItem(RUN_TRACKING_SESSION_KEY, JSON.stringify(session));
  } catch (error) {
    // Ignore storage write issues to keep tracking alive.
  }
};

const maybeRefreshForegroundNotification = async session => {
  if (Platform.OS !== 'android' || !session?.active) {
    return session;
  }

  const now = Date.now();
  const lastUpdated = toNumber(session.notificationUpdatedAt, 0);
  if (now - lastUpdated < NOTIFICATION_REFRESH_MS) {
    return session;
  }

  try {
    const started = await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK_NAME);
    if (!started) return session;

    await Location.startLocationUpdatesAsync(
      RUN_TRACKING_TASK_NAME,
      buildLocationOptions(session)
    );

    return { ...session, notificationUpdatedAt: now };
  } catch (error) {
    return session;
  }
};

if (!TaskManager.isTaskDefined(RUN_TRACKING_TASK_NAME)) {
  TaskManager.defineTask(RUN_TRACKING_TASK_NAME, async ({ data, error }) => {
    if (error) return;

    const locations = data?.locations;
    if (!Array.isArray(locations) || locations.length === 0) return;

    const session = await readSession();
    if (!session?.active) return;

    let nextSession = session;
    for (const location of locations) {
      nextSession = appendLocationToSession(nextSession, location);
    }

    nextSession = await maybeRefreshForegroundNotification(nextSession);
    await writeSession(nextSession);
  });
}

export const requestRunTrackingPermissions = async () => {
  const foreground = await Location.requestForegroundPermissionsAsync();
  const foregroundGranted = foreground.status === 'granted';
  if (!foregroundGranted) {
    return { foregroundGranted: false, backgroundGranted: false };
  }

  if (Platform.OS !== 'android') {
    return { foregroundGranted: true, backgroundGranted: true };
  }

  // Android foreground-service tracking can start with foreground location only.
  const background = await Location.getBackgroundPermissionsAsync().catch(() => null);
  return {
    foregroundGranted: true,
    backgroundGranted: background?.status === 'granted',
  };
};

export const startRunTracking = async ({ startedAt = Date.now(), seedLocation = null } = {}) => {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK_NAME);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(RUN_TRACKING_TASK_NAME);
  }

  let session = createSession(startedAt);
  if (seedLocation) {
    session = appendLocationToSession(session, seedLocation);
  }

  await writeSession(session);
  await Location.startLocationUpdatesAsync(RUN_TRACKING_TASK_NAME, buildLocationOptions(session));
  return session;
};

export const getRunTrackingSession = async () => {
  return readSession();
};

export const stopRunTracking = async () => {
  const hasStarted = await Location.hasStartedLocationUpdatesAsync(RUN_TRACKING_TASK_NAME);
  if (hasStarted) {
    await Location.stopLocationUpdatesAsync(RUN_TRACKING_TASK_NAME);
  }

  let session = await readSession();
  if (!session) return null;

  try {
    const latestLocation =
      (await Location.getLastKnownPositionAsync({
        maxAge: 20000,
        requiredAccuracy: MAX_POINT_ACCURACY_M,
      })) ||
      (await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }));

    if (latestLocation) {
      session = appendLocationToSession(session, latestLocation);
    }
  } catch (error) {
    // Keep the session data already collected if the final location read fails.
  }

  const endedSession = {
    ...session,
    active: false,
    endedAt: Date.now(),
  };
  await writeSession(endedSession);
  return endedSession;
};

export const clearRunTrackingSession = async () => {
  try {
    await AsyncStorage.removeItem(RUN_TRACKING_SESSION_KEY);
  } catch (error) {
    // Ignore clear issues.
  }
};
