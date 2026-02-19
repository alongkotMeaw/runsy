import { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { ref, onValue } from 'firebase/database';

import BottomTab from '../components/BottomTab';
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

export default function HistoryScreen({ navigation, route }) {
  const uid = route?.params?.uid || auth.currentUser?.uid || null;

  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);

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
              <Text style={styles.emptyTitle}>No runs yet</Text>
              <Text style={styles.emptySub}>Start your first run to see it here.</Text>
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
                image={run.mapImage}
                createdAt={run.createdAt}
              />
            ))
          )}
        </ScrollView>
      )}

      <BottomTab navigation={navigation} uid={uid} active="History" />
    </SafeAreaView>
  );
}

function SummaryChip({ label, value }) {
  return (
    <View style={styles.summaryChip}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
  );
}

function RunCard({ distance, duration, pace, steps, calories, image, createdAt }) {
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
      </View>

      {image ? <Image source={{ uri: image }} style={styles.routeImage} /> : null}
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
  summaryChip: {
    flex: 1,
    ...surfaces.card,
    paddingVertical: 10,
    paddingHorizontal: 10,
    ...shadows.light,
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
    ...shadows.light,
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '700',
  },
  emptySub: {
    marginTop: 4,
    color: palette.textMuted,
    fontSize: 13,
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
    height: 148,
    borderRadius: radii.md,
    marginTop: 6,
  },
});
