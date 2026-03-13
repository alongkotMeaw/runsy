// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
  Pressable,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { ref, onValue } from 'firebase/database';

import BottomTab from '../../components/BottomTab';
import { withLegacyRoute } from '../createLegacyRoute';
import { auth, database } from '../../firebaseConfig';
import {
  gradients,
  palette,
  radii,
  shadows,
  spacing,
  surfaces,
  typography,
} from '../../theme/premiumTheme';

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatDuration = seconds => {
  const total = Math.max(0, Math.round(toNumber(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;

  if (h > 0) {
    return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  }

  return `${m}:${s.toString().padStart(2, '0')}`;
};

const formatDateTime = timestamp => {
  const value = toNumber(timestamp);
  if (!value) return 'Unknown date';
  return new Date(value).toLocaleString();
};

const formatPace = (seconds, distanceKm) => {
  if (!Number.isFinite(seconds) || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return '--';
  }

  const paceSeconds = Math.round(seconds / distanceKm);
  const minutes = Math.floor(paceSeconds / 60);
  const secondsLeft = paceSeconds % 60;
  return `${minutes}:${secondsLeft.toString().padStart(2, '0')}`;
};

function HistoryScreen({ navigation, route }) {
  const uid = route?.params?.uid || auth.currentUser?.uid || null;

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRun, setSelectedRun] = useState(null);

  useEffect(() => {
    if (!uid) {
      setRuns([]);
      setLoading(false);
      return;
    }

    const runsRef = ref(database, `users/${uid}/runs`);
    const unsubscribe = onValue(runsRef, snapshot => {
      if (snapshot.exists()) {
        const data = snapshot.val();
        const list = Object.keys(data)
          .map(key => ({ id: key, ...data[key] }))
          .sort((a, b) => toNumber(b.createdAt) - toNumber(a.createdAt));
        setRuns(list);
      } else {
        setRuns([]);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [uid]);

  const totals = useMemo(() => {
    if (!runs.length) {
      return { count: 0, distance: 0, duration: 0 };
    }

    return {
      count: runs.length,
      distance: runs.reduce((sum, run) => sum + toNumber(run.distance), 0),
      duration: runs.reduce((sum, run) => sum + toNumber(run.time), 0),
    };
  }, [runs]);

  const highlights = useMemo(() => {
    if (!runs.length) {
      return {
        bestDistance: 0,
        averagePace: '--',
        routeCoverage: 0,
      };
    }

    const bestDistance = runs.reduce(
      (currentBest, run) => Math.max(currentBest, toNumber(run.distance)),
      0
    );
    const totalDistance = runs.reduce((sum, run) => sum + toNumber(run.distance), 0);
    const totalTime = runs.reduce((sum, run) => sum + toNumber(run.time), 0);
    const routeCoverage = runs.filter(run => Boolean(run.mapImage)).length;

    return {
      bestDistance: Number(bestDistance.toFixed(2)),
      averagePace: formatPace(totalTime, totalDistance),
      routeCoverage,
    };
  }, [runs]);

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={gradients.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <View style={styles.header}>
        <Text style={styles.headerTitle}>Run History</Text>
        <Text style={styles.headerSub}>Your previous sessions and route snapshots.</Text>
      </View>

      <View style={styles.summaryRow}>
        <SummaryChip label="Sessions" value={totals.count.toString()} />
        <SummaryChip label="Distance" value={`${totals.distance.toFixed(1)} km`} />
        <SummaryChip label="Time" value={formatDuration(totals.duration)} />
      </View>

      <View style={styles.highlightRow}>
        <HighlightCard
          icon="ribbon-outline"
          label="Best Distance"
          value={`${highlights.bestDistance.toFixed(2)} km`}
        />
        <HighlightCard
          icon="speedometer-outline"
          label="Avg Pace"
          value={`${highlights.averagePace}/km`}
        />
        <HighlightCard
          icon="map-outline"
          label="Snapshots"
          value={`${highlights.routeCoverage}/${runs.length || 0}`}
        />
      </View>

      {loading ? (
        <View style={styles.loaderWrap}>
          <ActivityIndicator size="small" color={palette.accent} />
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          {runs.length === 0 ? (
            <View style={styles.emptyCard}>
              <Ionicons name="time-outline" size={22} color={palette.accent} />
              <Text style={styles.emptyTitle}>No runs yet</Text>
              <Text style={styles.emptySub}>Start your first run to see it here.</Text>
              <Pressable
                style={styles.emptyAction}
                onPress={() => navigation.navigate('Run', { uid })}
              >
                <Text style={styles.emptyActionText}>Start a Run</Text>
              </Pressable>
            </View>
          ) : (
            runs.map(run => (
              <RunCard
                key={run.id}
                distance={toNumber(run.distance).toFixed(2)}
                duration={formatDuration(run.time)}
                pace={run.pace || '--'}
                steps={toNumber(run.steps)}
                calories={toNumber(run.calories)}
                averageSpeedKmh={toNumber(run.averageSpeedKmh)}
                image={run.mapImage}
                createdAt={run.createdAt}
                onPressImage={() =>
                  setSelectedRun({
                    image: run.mapImage,
                    distance: toNumber(run.distance).toFixed(2),
                    duration: formatDuration(run.time),
                    pace: run.pace || '--',
                    speed: toNumber(run.averageSpeedKmh),
                    createdAt: run.createdAt,
                  })
                }
              />
            ))
          )}
        </ScrollView>
      )}

      <Modal
        visible={Boolean(selectedRun)}
        animationType="fade"
        transparent
        onRequestClose={() => setSelectedRun(null)}
      >
        <View style={styles.viewerBackdrop}>
          <Pressable style={styles.viewerClose} onPress={() => setSelectedRun(null)}>
            <Text style={styles.viewerCloseText}>Close</Text>
          </Pressable>

          {selectedRun?.image ? (
            <Image source={{ uri: selectedRun.image }} style={styles.viewerImage} resizeMode="contain" />
          ) : null}

          <View style={styles.viewerMeta}>
            <Text style={styles.viewerMetaTitle}>{selectedRun?.distance || '--'} km</Text>
            <Text style={styles.viewerMetaText}>
              {selectedRun?.duration || '--'} • {selectedRun ? formatDateTime(selectedRun.createdAt) : '--'}
            </Text>
            <View style={styles.viewerMetaRow}>
              <ViewerChip icon="speedometer-outline" label={`${selectedRun?.pace || '--'}/km`} />
              <ViewerChip
                icon="flash-outline"
                label={
                  Number.isFinite(selectedRun?.speed) && selectedRun.speed > 0
                    ? `${selectedRun.speed.toFixed(1)} km/h`
                    : '--'
                }
              />
            </View>
          </View>
        </View>
      </Modal>

      <BottomTab navigation={navigation} uid={uid} active="History" />
    </SafeAreaView>
  );
}

export default withLegacyRoute(HistoryScreen);

function SummaryChip({ label, value }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function HighlightCard({ icon, label, value }) {
  return (
    <View style={styles.highlightCard}>
      <View style={styles.highlightIcon}>
        <Ionicons name={icon} size={16} color={palette.accent} />
      </View>
      <Text style={styles.highlightLabel}>{label}</Text>
      <Text style={styles.highlightValue}>{value}</Text>
    </View>
  );
}

function RunCard({
  distance,
  duration,
  pace,
  steps,
  calories,
  averageSpeedKmh,
  image,
  createdAt,
  onPressImage,
}) {
  return (
    <View style={styles.runCard}>
      <View style={styles.runHeader}>
        <Text style={styles.runTitle}>Run</Text>
        <Text style={styles.runDistance}>{distance} km</Text>
      </View>

      <Text style={styles.runDate}>{formatDateTime(createdAt)}</Text>

      <View style={styles.runMetaRow}>
        <MetaItem label="Duration" value={duration} />
        <MetaItem label="Pace" value={`${pace}/km`} />
        <MetaItem label="Steps" value={steps > 0 ? steps.toLocaleString() : '--'} />
      </View>

      <View style={styles.runMetaRow}>
        <MetaItem label="Calories" value={calories > 0 ? `${calories} kcal` : '--'} />
        <MetaItem
          label="Avg Speed"
          value={averageSpeedKmh > 0 ? `${averageSpeedKmh.toFixed(1)} km/h` : '--'}
        />
      </View>

      {image ? (
        <Pressable style={styles.routeImageWrap} onPress={onPressImage}>
          <Image source={{ uri: image }} style={styles.routeImage} />
          <View style={styles.routeImageHint}>
            <Text style={styles.routeImageHintText}>Tap to expand</Text>
          </View>
        </Pressable>
      ) : (
        <View style={styles.routePlaceholder}>
          <Ionicons name="image-outline" size={18} color={palette.textMuted} />
          <Text style={styles.routePlaceholderText}>Route preview unavailable for this run.</Text>
        </View>
      )}
    </View>
  );
}

function MetaItem({ label, value }) {
  return (
    <View style={styles.metaItem}>
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}

function ViewerChip({ icon, label }) {
  return (
    <View style={styles.viewerChip}>
      <Ionicons name={icon} size={14} color={palette.textSecondary} />
      <Text style={styles.viewerChipText}>{label}</Text>
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
  header: {
    marginBottom: 12,
  },
  headerTitle: {
    ...typography.title,
    fontSize: 28,
  },
  headerSub: {
    marginTop: 4,
    color: palette.textSecondary,
    fontSize: 13,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  highlightRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  summaryChip: {
    flex: 1,
    ...surfaces.card,
    paddingVertical: 10,
    paddingHorizontal: 10,
    ...shadows.light,
  },
  highlightCard: {
    flex: 1,
    ...surfaces.cardStrong,
    paddingVertical: 12,
    paddingHorizontal: 10,
    ...shadows.light,
  },
  highlightIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: 'rgba(249,115,22,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  highlightLabel: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  highlightValue: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '800',
    marginTop: 5,
  },
  summaryLabel: {
    color: palette.textMuted,
    fontSize: 11,
  },
  summaryValue: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 2,
  },
  loaderWrap: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    gap: 10,
    paddingBottom: 120,
  },
  emptyCard: {
    ...surfaces.card,
    alignItems: 'center',
    paddingVertical: 26,
    paddingHorizontal: 18,
    ...shadows.light,
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginTop: 10,
  },
  emptySub: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 13,
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: 14,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(249,115,22,0.16)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  emptyActionText: {
    color: '#fdba74',
    fontSize: 12,
    fontWeight: '700',
  },
  runCard: {
    ...surfaces.cardStrong,
    borderRadius: radii.lg,
    padding: 14,
    gap: 6,
    ...shadows.light,
  },
  runHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  runTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  runDistance: {
    color: '#fdba74',
    fontWeight: '700',
  },
  runDate: {
    color: palette.textMuted,
    fontSize: 11,
  },
  runMetaRow: {
    flexDirection: 'row',
    gap: 8,
  },
  metaItem: {
    flex: 1,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(15,23,42,0.72)',
    paddingVertical: 7,
    paddingHorizontal: 8,
  },
  metaLabel: {
    color: palette.textMuted,
    fontSize: 10,
  },
  metaValue: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 1,
  },
  routeImage: {
    width: '100%',
    height: 148,
    borderRadius: radii.md,
    marginTop: 0,
  },
  routeImageWrap: {
    marginTop: 6,
  },
  routeImageHint: {
    position: 'absolute',
    right: 10,
    bottom: 10,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(6,11,20,0.78)',
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  routeImageHintText: {
    color: palette.textPrimary,
    fontSize: 10,
    fontWeight: '700',
  },
  routePlaceholder: {
    marginTop: 6,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.14)',
    backgroundColor: 'rgba(15,23,42,0.58)',
    paddingVertical: 18,
    paddingHorizontal: 12,
    alignItems: 'center',
    gap: 8,
  },
  routePlaceholderText: {
    color: palette.textMuted,
    fontSize: 12,
    textAlign: 'center',
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2,6,12,0.96)',
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.screenTop + 16,
    paddingBottom: 24,
    justifyContent: 'center',
  },
  viewerClose: {
    position: 'absolute',
    top: spacing.screenTop + 8,
    right: spacing.screenHorizontal,
    zIndex: 2,
    borderRadius: radii.pill,
    backgroundColor: 'rgba(15,23,42,0.92)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  viewerCloseText: {
    color: palette.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  viewerImage: {
    width: '100%',
    height: '72%',
    borderRadius: radii.lg,
  },
  viewerMeta: {
    marginTop: 16,
    alignItems: 'center',
  },
  viewerMetaTitle: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  viewerMetaText: {
    color: palette.textSecondary,
    fontSize: 12,
    marginTop: 6,
    textAlign: 'center',
  },
  viewerMetaRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  viewerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: 'rgba(13,22,39,0.88)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  viewerChipText: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
});
