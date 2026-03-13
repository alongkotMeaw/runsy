// @ts-nocheck
import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ref, get } from 'firebase/database';

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

const DEFAULT_WEEKLY_GOAL_KM = 20;
const DAY_MS = 24 * 60 * 60 * 1000;

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatPace = secondsPerKm => {
  if (!Number.isFinite(secondsPerKm) || secondsPerKm <= 0) return '--';
  const totalSeconds = Math.round(secondsPerKm);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

const formatDuration = seconds => {
  const total = Math.max(0, Math.round(toNumber(seconds)));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);

  if (h > 0) return `${h}h ${m}m`;
  return `${m} min`;
};

const getGreeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
};

function DashBoard({ route, navigation }) {
  const uid = route?.params?.uid || auth.currentUser?.uid || null;

  const [user, setUser] = useState(null);
  const [todayStats, setTodayStats] = useState({
    distance: 0,
    seconds: 0,
    pace: '--',
  });
  const [weeklyStats, setWeeklyStats] = useState({
    distance: 0,
    goalKm: DEFAULT_WEEKLY_GOAL_KM,
  });
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [insights, setInsights] = useState({
    latestRun: null,
    bestDistance: 0,
    activeDays: 0,
  });

  const loadDashboardData = useCallback(async ({ silent = false } = {}) => {
    if (!uid) return;

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorText('');

    try {
      const [userSnap, runsSnap, usersSnap] = await Promise.all([
        get(ref(database, `users/${uid}`)),
        get(ref(database, `users/${uid}/runs`)),
        get(ref(database, 'users')),
      ]);

      const userData = userSnap.exists() ? userSnap.val() : null;
      const runList = runsSnap.exists() ? Object.values(runsSnap.val()) : [];
      const usersData = usersSnap.exists() ? usersSnap.val() : {};

      setUser(userData);

      const dayStart = new Date();
      dayStart.setHours(0, 0, 0, 0);
      const todayStartTs = dayStart.getTime();
      const weekStartTs = todayStartTs - 6 * DAY_MS;

      let todayDistance = 0;
      let todaySeconds = 0;
      let weekDistance = 0;

      for (const run of runList) {
        const createdAt = toNumber(run.createdAt);
        const distance = toNumber(run.distance);
        const time = toNumber(run.time);

        if (createdAt >= todayStartTs) {
          todayDistance += distance;
          todaySeconds += time;
        }

        if (createdAt >= weekStartTs) {
          weekDistance += distance;
        }
      }

      const goalKm = Math.max(1, toNumber(userData?.weeklyGoalKm) || DEFAULT_WEEKLY_GOAL_KM);

      setTodayStats({
        distance: Number(todayDistance.toFixed(2)),
        seconds: Math.round(todaySeconds),
        pace: todayDistance > 0 ? formatPace(todaySeconds / todayDistance) : '--',
      });

      setWeeklyStats({
        distance: Number(weekDistance.toFixed(2)),
        goalKm,
      });

      const activeDays = new Set(
        runList
          .map(run => {
            const createdAt = toNumber(run.createdAt);
            if (!createdAt) return null;
            const current = new Date(createdAt);
            current.setHours(0, 0, 0, 0);
            return current.getTime();
          })
          .filter(Boolean)
      ).size;

      const sortedRuns = [...runList].sort((a, b) => toNumber(b.createdAt) - toNumber(a.createdAt));
      const latestRun = sortedRuns[0] || null;
      const bestDistance = runList.reduce(
        (currentBest, run) => Math.max(currentBest, toNumber(run.distance)),
        0
      );

      setInsights({
        latestRun,
        bestDistance: Number(bestDistance.toFixed(2)),
        activeDays,
      });

      const ranking = Object.entries(usersData)
        .map(([id, data]) => {
          const runnerRuns = data?.runs ? Object.values(data.runs) : [];
          const totalDistance = runnerRuns.reduce((sum, run) => sum + toNumber(run.distance), 0);

          return {
            id,
            name: data?.username || data?.email || 'Runner',
            distance: Number(totalDistance.toFixed(2)),
            isCurrentUser: id === uid,
          };
        })
        .filter(runner => runner.distance > 0 || runner.isCurrentUser)
        .sort((a, b) => b.distance - a.distance)
        .slice(0, 3);

      setLeaders(ranking);
    } catch (error) {
      setErrorText('Unable to load dashboard data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      loadDashboardData();
    }, [loadDashboardData])
  );

  const greeting = useMemo(() => getGreeting(), []);
  const avatarLabel = useMemo(() => {
    const name = user?.username || user?.email || 'Runner';
    return name.charAt(0).toUpperCase();
  }, [user?.username, user?.email]);

  if (!uid) {
    return (
      <SafeAreaView style={styles.container}>
        <Text style={styles.errorText}>User session not found.</Text>
      </SafeAreaView>
    );
  }

  const weeklyProgress = Math.min(100, Math.round((weeklyStats.distance / weeklyStats.goalKm) * 100));

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

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboardData({ silent: true })}
            tintColor={palette.accent}
          />
        }
      >
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}</Text>
            <Text style={styles.name}>{user?.username || 'Runner'}, let's train.</Text>
          </View>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLabel}</Text>
          </View>
        </View>

        <Pressable
          style={styles.startCardWrap}
          onPress={() => navigation.navigate('Run', { uid })}
        >
          <LinearGradient colors={gradients.hero} style={styles.startCard}>
            <View>
              <Text style={styles.startKicker}>Today Session</Text>
              <Text style={styles.startTitle}>Start a new run</Text>
            </View>
            <View style={styles.startIconWrap}>
              <Ionicons name="play" size={20} color={palette.textPrimary} />
            </View>
          </LinearGradient>
        </Pressable>

        {loading ? (
          <View style={styles.loaderWrap}>
            <ActivityIndicator color={palette.accent} size="small" />
          </View>
        ) : (
          <>
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <Text style={styles.sectionTitle}>Today Stats</Text>
            <View style={styles.statsRow}>
              <StatBox title="Distance" value={`${todayStats.distance.toFixed(2)} km`} />
              <StatBox title="Duration" value={formatDuration(todayStats.seconds)} />
              <StatBox title="Pace" value={`${todayStats.pace}/km`} />
            </View>

            <Text style={styles.sectionTitle}>Session Insight</Text>
            {insights.latestRun ? (
              <View style={styles.insightCard}>
                <View>
                  <Text style={styles.insightKicker}>Latest Run</Text>
                  <Text style={styles.insightTitle}>
                    {toNumber(insights.latestRun.distance).toFixed(2)} km session
                  </Text>
                  <Text style={styles.insightText}>
                    {formatDuration(insights.latestRun.time)} total time at {insights.latestRun.pace || '--'}/km
                  </Text>
                </View>
                <Pressable
                  style={styles.inlineAction}
                  onPress={() => navigation.navigate('History', { uid })}
                >
                  <Text style={styles.inlineActionText}>Open History</Text>
                </Pressable>
              </View>
            ) : (
              <Pressable
                style={styles.insightCard}
                onPress={() => navigation.navigate('Run', { uid })}
              >
                <View>
                  <Text style={styles.insightKicker}>First Session</Text>
                  <Text style={styles.insightTitle}>No runs recorded yet</Text>
                  <Text style={styles.insightText}>
                    Start your first session to unlock pace trends, route history, and records.
                  </Text>
                </View>
                <View style={styles.startMiniBadge}>
                  <Ionicons name="arrow-forward" size={16} color={palette.textPrimary} />
                </View>
              </Pressable>
            )}

            <Text style={styles.sectionTitle}>Weekly Goal</Text>
            <View style={styles.goalCard}>
              <View style={styles.goalTopRow}>
                <Text style={styles.goalText}>
                  {weeklyStats.distance.toFixed(2)} / {weeklyStats.goalKm} km
                </Text>
                <Text style={styles.goalPercent}>{weeklyProgress}%</Text>
              </View>
              <View style={styles.progressBg}>
                <LinearGradient
                  colors={['#f97316', '#22c55e']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.progressFill, { width: `${weeklyProgress}%` }]}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Consistency</Text>
            <View style={styles.consistencyRow}>
              <InsightBox
                icon="calendar-outline"
                title="Active Days"
                value={`${insights.activeDays}`}
                subtitle="days with recorded runs"
              />
              <InsightBox
                icon="ribbon-outline"
                title="Best Distance"
                value={`${insights.bestDistance.toFixed(2)} km`}
                subtitle="best single session"
              />
            </View>

            <Text style={styles.sectionTitle}>Leaderboard</Text>
            {leaders.length === 0 ? (
              <Text style={styles.emptyText}>No ranking data yet.</Text>
            ) : (
              <View style={styles.rankList}>
                {leaders.map((runner, index) => (
                  <RankCard
                    key={runner.id}
                    rank={index + 1}
                    name={runner.name}
                    km={runner.distance}
                    highlight={runner.isCurrentUser}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>

      <BottomTab navigation={navigation} uid={uid} active="Home" />
    </SafeAreaView>
  );
}

export default withLegacyRoute(DashBoard);

function StatBox({ title, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statTitle}>{title}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function RankCard({ rank, name, km, highlight }) {
  return (
    <View style={[styles.rankCard, highlight && styles.rankCardHighlight]}>
      <View style={styles.rankBadge}>
        <Text style={styles.rankBadgeText}>#{rank}</Text>
      </View>
      <View style={styles.rankMain}>
        <Text style={styles.rankName} numberOfLines={1}>{name}</Text>
        <Text style={styles.rankKm}>{km.toFixed(2)} km total</Text>
      </View>
    </View>
  );
}

function InsightBox({ icon, title, value, subtitle }) {
  return (
    <View style={styles.insightBox}>
      <View style={styles.insightBoxIcon}>
        <Ionicons name={icon} size={16} color={palette.accent} />
      </View>
      <Text style={styles.insightBoxTitle}>{title}</Text>
      <Text style={styles.insightBoxValue}>{value}</Text>
      <Text style={styles.insightBoxSubtitle}>{subtitle}</Text>
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
    backgroundColor: 'rgba(34,197,94,0.16)',
    top: -80,
    right: -40,
  },
  glowB: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    backgroundColor: 'rgba(249,115,22,0.14)',
    bottom: 140,
    left: -50,
  },
  content: {
    paddingBottom: 120,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sectionGap,
  },
  greeting: {
    color: palette.textPrimary,
    fontSize: 24,
    fontWeight: '800',
  },
  name: {
    color: palette.textSecondary,
    marginTop: 2,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(15,23,42,0.82)',
    borderWidth: 1,
    borderColor: palette.borderSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: palette.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  startCardWrap: {
    marginBottom: spacing.sectionGap,
    borderRadius: radii.lg,
    overflow: 'hidden',
    ...shadows.soft,
  },
  startCard: {
    padding: 18,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: palette.borderSoft,
  },
  startKicker: {
    color: '#fcd34d',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  startTitle: {
    marginTop: 4,
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  startIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: 'rgba(249,115,22,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loaderWrap: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  sectionTitle: {
    ...typography.section,
    marginBottom: 8,
    marginTop: 4,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: spacing.sectionGap,
  },
  insightCard: {
    ...surfaces.cardStrong,
    padding: 14,
    marginBottom: spacing.sectionGap,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
    ...shadows.light,
  },
  insightKicker: {
    color: '#fdba74',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  insightTitle: {
    color: palette.textPrimary,
    fontSize: 17,
    fontWeight: '800',
    marginTop: 4,
  },
  insightText: {
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
    maxWidth: 220,
  },
  inlineAction: {
    borderRadius: radii.pill,
    backgroundColor: 'rgba(249,115,22,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  inlineActionText: {
    color: '#fdba74',
    fontWeight: '700',
    fontSize: 12,
  },
  startMiniBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(249,115,22,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  statBox: {
    flex: 1,
    ...surfaces.card,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    ...shadows.light,
  },
  statTitle: {
    color: palette.textMuted,
    fontSize: 11,
  },
  statValue: {
    marginTop: 3,
    color: palette.textPrimary,
    fontWeight: '700',
    fontSize: 14,
    textAlign: 'center',
  },
  goalCard: {
    ...surfaces.card,
    padding: 14,
    marginBottom: spacing.sectionGap,
    ...shadows.light,
  },
  goalTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  goalText: {
    color: palette.textPrimary,
    fontWeight: '700',
  },
  goalPercent: {
    color: palette.textSecondary,
    fontWeight: '700',
    fontSize: 12,
  },
  progressBg: {
    height: 8,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(30,41,59,0.86)',
  },
  progressFill: {
    height: 8,
    borderRadius: 999,
  },
  consistencyRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  insightBox: {
    flex: 1,
    ...surfaces.card,
    padding: 14,
    ...shadows.light,
  },
  insightBoxIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.14)',
    marginBottom: 10,
  },
  insightBoxTitle: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  insightBoxValue: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
    marginTop: 6,
  },
  insightBoxSubtitle: {
    color: palette.textSecondary,
    fontSize: 11,
    marginTop: 4,
    lineHeight: 16,
  },
  rankList: {
    gap: 8,
  },
  rankCard: {
    ...surfaces.card,
    padding: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.light,
  },
  rankCardHighlight: {
    borderColor: 'rgba(249,115,22,0.5)',
    backgroundColor: 'rgba(76, 29, 9, 0.48)',
  },
  rankBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.22)',
    marginRight: 10,
  },
  rankBadgeText: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  rankMain: {
    flex: 1,
  },
  rankName: {
    color: palette.textPrimary,
    fontWeight: '700',
  },
  rankKm: {
    color: palette.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  emptyText: {
    color: palette.textMuted,
  },
  errorText: {
    color: '#fca5a5',
    textAlign: 'center',
    marginVertical: 8,
  },
});
