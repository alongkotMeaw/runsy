// @ts-nocheck
import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { signOut } from 'firebase/auth';
import { get, ref } from 'firebase/database';

import BottomTab from '../../../components/BottomTab';
import { withLegacyRoute } from '../../createLegacyRoute';
import { auth, database } from '../../../firebaseConfig';
import {
  gradients,
  palette,
  radii,
  shadows,
  spacing,
  surfaces,
  typography,
} from '../../../theme/premiumTheme';

const DAY_MS = 24 * 60 * 60 * 1000;
const DEFAULT_WEEKLY_GOAL_KM = 20;

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

const formatPace = (seconds, distanceKm) => {
  if (!Number.isFinite(seconds) || !Number.isFinite(distanceKm) || distanceKm <= 0) {
    return '--';
  }

  const paceSeconds = Math.round(seconds / distanceKm);
  const minutes = Math.floor(paceSeconds / 60);
  const remainder = paceSeconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, '0')}`;
};

const formatDateLabel = timestamp => {
  const value = toNumber(timestamp);
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
};

const formatDateTime = timestamp => {
  const value = toNumber(timestamp);
  if (!value) return '-';
  return new Date(value).toLocaleString();
};

const formatCompactNumber = value => {
  if (!Number.isFinite(value) || value <= 0) return '0';
  if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
  return `${Math.round(value)}`;
};

const calculateAge = birthDate => {
  if (!birthDate) return null;

  const current = new Date();
  const birth = new Date(birthDate);
  if (Number.isNaN(birth.getTime())) return null;

  let age = current.getFullYear() - birth.getFullYear();
  const monthDiff = current.getMonth() - birth.getMonth();
  const dayDiff = current.getDate() - birth.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

const calculateProfileCompletion = profile => {
  const checks = [
    Boolean(profile?.username),
    Boolean(profile?.email),
    Boolean(profile?.gender),
    toNumber(profile?.weight) > 0,
    toNumber(profile?.height) > 0,
    Boolean(profile?.birthDate),
    toNumber(profile?.weeklyGoalKm) > 0,
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

const calculateStreakDays = runs => {
  if (!runs.length) return 0;

  const daySet = new Set(
    runs
      .map(run => {
        const createdAt = toNumber(run.createdAt);
        if (!createdAt) return null;
        const currentDay = new Date(createdAt);
        currentDay.setHours(0, 0, 0, 0);
        return currentDay.getTime();
      })
      .filter(Boolean)
  );

  let cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  if (!daySet.has(cursor.getTime())) {
    cursor = new Date(cursor.getTime() - DAY_MS);
    if (!daySet.has(cursor.getTime())) {
      return 0;
    }
  }

  let streak = 0;
  while (daySet.has(cursor.getTime())) {
    streak += 1;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }

  return streak;
};

const getRunnerLevel = totalDistanceKm => {
  if (totalDistanceKm >= 250) {
    return {
      title: 'Endurance Pro',
      subtitle: 'Strong base, proven consistency, and serious mileage.',
    };
  }

  if (totalDistanceKm >= 120) {
    return {
      title: 'Distance Builder',
      subtitle: 'Your profile shows real momentum and reliable training volume.',
    };
  }

  if (totalDistanceKm >= 50) {
    return {
      title: 'City Runner',
      subtitle: 'You have enough sessions logged to shape a real routine.',
    };
  }

  if (totalDistanceKm >= 15) {
    return {
      title: 'Momentum',
      subtitle: 'You are building consistency and turning runs into habit.',
    };
  }

  return {
    title: 'Starter',
    subtitle: 'Complete a few more sessions to unlock deeper training insights.',
  };
};

const buildAchievements = ({ runs, totalDistanceKm, streakDays, goalReached, records }) => [
  { key: 'first-run', label: 'First Run', icon: 'flag-outline', unlocked: runs.length >= 1 },
  { key: 'ten-sessions', label: '10 Sessions', icon: 'walk-outline', unlocked: runs.length >= 10 },
  { key: 'distance-50', label: '50 km Total', icon: 'ribbon-outline', unlocked: totalDistanceKm >= 50 },
  { key: 'streak', label: '3 Day Streak', icon: 'flame-outline', unlocked: streakDays >= 3 },
  { key: 'goal', label: 'Weekly Goal Hit', icon: 'trophy-outline', unlocked: goalReached },
  { key: 'record', label: '5K Ready', icon: 'speedometer-outline', unlocked: records.fiveK !== '--' },
];

const capitalizeLabel = value => {
  if (!value) return '-';
  const normalized = String(value).replace(/_/g, ' ');
  return normalized.charAt(0).toUpperCase() + normalized.slice(1);
};

function ProfileScreen({ navigation, route }) {
  const uid = route?.params?.uid || auth.currentUser?.uid || null;

  const [profile, setProfile] = useState(null);
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [errorText, setErrorText] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const loadProfile = useCallback(async ({ silent = false } = {}) => {
    if (!uid) {
      setLoading(false);
      setErrorText('User session not found.');
      return;
    }

    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    setErrorText('');

    try {
      const [userSnap, runsSnap] = await Promise.all([
        get(ref(database, `users/${uid}`)),
        get(ref(database, `users/${uid}/runs`)),
      ]);

      const userData = userSnap.exists() ? userSnap.val() : {};
      const runList = runsSnap.exists()
        ? Object.values(runsSnap.val()).sort((a, b) => toNumber(b.createdAt) - toNumber(a.createdAt))
        : [];

      setProfile(userData);
      setRuns(runList);
    } catch (error) {
      setErrorText('Unable to load profile data.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const profileSummary = useMemo(() => {
    const totalRuns = runs.length;
    const totalDistance = runs.reduce((sum, run) => sum + toNumber(run.distance), 0);
    const totalTime = runs.reduce((sum, run) => sum + toNumber(run.time), 0);
    const totalCalories = runs.reduce((sum, run) => sum + toNumber(run.calories), 0);
    const averageSpeed = totalTime > 0 ? totalDistance / (totalTime / 3600) : 0;
    const averagePace = totalDistance > 0 ? formatPace(totalTime, totalDistance) : '--';

    const bestFiveK = (() => {
      let best = Infinity;
      for (const run of runs) {
        const distance = toNumber(run.distance);
        const time = toNumber(run.time);
        if (distance >= 5 && distance > 0 && time > 0) {
          best = Math.min(best, (time / distance) * 5);
        }
      }
      return Number.isFinite(best) ? formatDuration(best) : '--';
    })();

    const bestTenK = (() => {
      let best = Infinity;
      for (const run of runs) {
        const distance = toNumber(run.distance);
        const time = toNumber(run.time);
        if (distance >= 10 && distance > 0 && time > 0) {
          best = Math.min(best, (time / distance) * 10);
        }
      }
      return Number.isFinite(best) ? formatDuration(best) : '--';
    })();

    const bestHalf = (() => {
      let best = Infinity;
      for (const run of runs) {
        const distance = toNumber(run.distance);
        const time = toNumber(run.time);
        if (distance >= 21.1 && distance > 0 && time > 0) {
          best = Math.min(best, (time / distance) * 21.1);
        }
      }
      return Number.isFinite(best) ? formatDuration(best) : '--';
    })();

    const now = Date.now();
    const weekStart = now - 6 * DAY_MS;
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const weekDistance = runs.reduce((sum, run) => {
      const createdAt = toNumber(run.createdAt);
      return createdAt >= weekStart ? sum + toNumber(run.distance) : sum;
    }, 0);
    const monthDistance = runs.reduce((sum, run) => {
      const createdAt = toNumber(run.createdAt);
      if (!createdAt) return sum;
      const current = new Date(createdAt);
      if (current.getMonth() === currentMonth && current.getFullYear() === currentYear) {
        return sum + toNumber(run.distance);
      }
      return sum;
    }, 0);

    const recentRun = runs[0] || null;
    const recentRunDistance = toNumber(recentRun?.distance);
    const recentRunTime = toNumber(recentRun?.time);
    const recentRunPace = recentRunDistance > 0 ? formatPace(recentRunTime, recentRunDistance) : '--';
    const streakDays = calculateStreakDays(runs);
    const weeklyGoalKm = Math.max(1, toNumber(profile?.weeklyGoalKm) || DEFAULT_WEEKLY_GOAL_KM);
    const weeklyGoalPct = Math.min(100, Math.round((weekDistance / weeklyGoalKm) * 100));
    const profileCompletion = calculateProfileCompletion(profile);
    const runnerLevel = getRunnerLevel(totalDistance);
    const records = {
      fiveK: bestFiveK,
      tenK: bestTenK,
      half: bestHalf,
    };
    const achievements = buildAchievements({
      runs,
      totalDistanceKm: totalDistance,
      streakDays,
      goalReached: weekDistance >= weeklyGoalKm,
      records,
    });

    return {
      totalRuns,
      totalDistance: Number(totalDistance.toFixed(2)),
      totalTime,
      totalCalories,
      averageSpeed: Number(averageSpeed.toFixed(1)),
      averagePace,
      weekDistance: Number(weekDistance.toFixed(2)),
      monthDistance: Number(monthDistance.toFixed(2)),
      streakDays,
      recentRun,
      recentRunDistance: Number(recentRunDistance.toFixed(2)),
      recentRunTime,
      recentRunPace,
      weeklyGoalKm,
      weeklyGoalPct,
      profileCompletion,
      runnerLevel,
      records,
      achievements,
    };
  }, [profile, runs]);

  const avatarLabel = useMemo(() => {
    const source = profile?.username || profile?.email || 'R';
    return source.charAt(0).toUpperCase();
  }, [profile?.username, profile?.email]);

  const memberSinceText = useMemo(() => formatDateLabel(profile?.createdAt), [profile?.createdAt]);
  const updatedAtText = useMemo(() => formatDateTime(profile?.updatedAt), [profile?.updatedAt]);
  const age = useMemo(() => calculateAge(profile?.birthDate), [profile?.birthDate]);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await signOut(auth);
    } catch (error) {
      Alert.alert('Error', 'Unable to log out right now.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const recentRunExists = Boolean(profileSummary.recentRun);
  const unlockedBadges = profileSummary.achievements.filter(item => item.unlocked).length;

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
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadProfile({ silent: true })}
            tintColor={palette.accent}
          />
        }
      >
        <View style={styles.pageHeader}>
          <View>
            <Text style={styles.pageTitle}>Profile</Text>
            <Text style={styles.pageSubtitle}>Manage your identity, goals, and training data.</Text>
          </View>
          <Pressable style={styles.headerAction} onPress={() => navigation.navigate('EditProfile', { uid })}>
            <Ionicons name="create-outline" size={16} color={palette.textPrimary} />
            <Text style={styles.headerActionText}>Edit</Text>
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={palette.accent} />
          </View>
        ) : (
          <>
            {errorText ? (
              <View style={styles.errorCard}>
                <Text style={styles.errorText}>{errorText}</Text>
                <Pressable style={styles.retryButton} onPress={() => loadProfile()}>
                  <Text style={styles.retryButtonText}>Retry</Text>
                </Pressable>
              </View>
            ) : null}

            <LinearGradient colors={gradients.hero} style={styles.heroCard}>
              <View style={styles.heroTopRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{avatarLabel}</Text>
                </View>
                <View style={styles.heroInfo}>
                  <Text style={styles.name}>{profile?.username || 'Runner'}</Text>
                  <Text style={styles.heroSubText}>{profile?.email || '-'}</Text>
                  <Text style={styles.heroSubText}>Member since {memberSinceText}</Text>
                </View>
              </View>

              <View style={styles.heroPillsRow}>
                <HeroPill icon="speedometer-outline" label={profileSummary.runnerLevel.title} />
                <HeroPill
                  icon="checkmark-circle-outline"
                  label={`${profileSummary.profileCompletion}% complete`}
                />
              </View>

              <Text style={styles.heroDescription}>{profileSummary.runnerLevel.subtitle}</Text>
              <View style={styles.completionTrack}>
                <View
                  style={[
                    styles.completionFill,
                    {
                      width:
                        profileSummary.profileCompletion > 0
                          ? `${Math.max(8, profileSummary.profileCompletion)}%`
                          : '0%',
                    },
                  ]}
                />
              </View>
              <Text style={styles.heroMetaText}>
                {unlockedBadges}/{profileSummary.achievements.length} achievements unlocked
              </Text>
            </LinearGradient>

            <View style={styles.actionRow}>
              <ActionTile
                icon="create-outline"
                label="Edit Profile"
                subLabel="Update account info"
                onPress={() => navigation.navigate('EditProfile', { uid })}
              />
              <ActionTile
                icon="time-outline"
                label="History"
                subLabel="Review past runs"
                onPress={() => navigation.navigate('History', { uid })}
              />
              <ActionTile
                icon="walk-outline"
                label="Start Run"
                subLabel="Begin a session"
                onPress={() => navigation.navigate('Run', { uid })}
              />
            </View>

            <View style={styles.metricGrid}>
              <MetricCard
                icon="walk-outline"
                label="Total Runs"
                value={profileSummary.totalRuns.toString()}
              />
              <MetricCard
                icon="navigate-outline"
                label="Distance"
                value={`${profileSummary.totalDistance} km`}
              />
              <MetricCard
                icon="speedometer-outline"
                label="Avg Pace"
                value={`${profileSummary.averagePace}/km`}
              />
              <MetricCard
                icon="flame-outline"
                label="Current Streak"
                value={`${profileSummary.streakDays} ${profileSummary.streakDays === 1 ? 'day' : 'days'}`}
              />
            </View>

            <View style={styles.goalCard}>
              <View style={styles.goalHeader}>
                <View>
                  <Text style={styles.goalTitle}>Weekly Goal</Text>
                  <Text style={styles.goalSubText}>
                    {profileSummary.weekDistance.toFixed(1)} / {profileSummary.weeklyGoalKm} km this week
                  </Text>
                </View>
                <Pressable
                  style={styles.goalEditButton}
                  onPress={() => navigation.navigate('EditProfile', { uid })}
                >
                  <Text style={styles.goalEditButtonText}>Adjust</Text>
                </Pressable>
              </View>

              <View style={styles.goalTrack}>
                <LinearGradient
                  colors={gradients.accentButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[
                    styles.goalFill,
                    {
                      width:
                        profileSummary.weeklyGoalPct > 0
                          ? `${Math.max(6, profileSummary.weeklyGoalPct)}%`
                          : '0%',
                    },
                  ]}
                />
              </View>

              <View style={styles.goalInsightRow}>
                <GoalInsight label="This month" value={`${profileSummary.monthDistance.toFixed(1)} km`} />
                <GoalInsight label="Calories" value={`${formatCompactNumber(profileSummary.totalCalories)} kcal`} />
                <GoalInsight
                  label="Avg speed"
                  value={profileSummary.averageSpeed > 0 ? `${profileSummary.averageSpeed} km/h` : '--'}
                />
              </View>
            </View>

            <Text style={styles.sectionTitle}>Recent Activity</Text>
            {recentRunExists ? (
              <View style={styles.sectionCard}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionCardTitle}>Latest run</Text>
                    <Text style={styles.sectionCardSubtitle}>
                      {formatDateTime(profileSummary.recentRun?.createdAt)}
                    </Text>
                  </View>
                  <Pressable onPress={() => navigation.navigate('History', { uid })}>
                    <Text style={styles.linkText}>Open history</Text>
                  </Pressable>
                </View>

                <View style={styles.recentStatsRow}>
                  <RecentRunStat label="Distance" value={`${profileSummary.recentRunDistance} km`} />
                  <RecentRunStat label="Duration" value={formatDuration(profileSummary.recentRunTime)} />
                  <RecentRunStat label="Pace" value={`${profileSummary.recentRunPace}/km`} />
                </View>
              </View>
            ) : (
              <Pressable style={styles.emptyCard} onPress={() => navigation.navigate('Run', { uid })}>
                <Ionicons name="walk-outline" size={20} color={palette.accent} />
                <Text style={styles.emptyTitle}>No runs recorded yet</Text>
                <Text style={styles.emptySubText}>
                  Start your first session to unlock progress tracking, records, and insights.
                </Text>
              </Pressable>
            )}

            <Text style={styles.sectionTitle}>Personal Records</Text>
            <View style={styles.recordsWrap}>
              <RecordCard label="5K Best" value={profileSummary.records.fiveK} />
              <RecordCard label="10K Best" value={profileSummary.records.tenK} />
              <RecordCard label="Half Marathon" value={profileSummary.records.half} />
            </View>

            <Text style={styles.sectionTitle}>Runner Profile</Text>
            <View style={styles.sectionCard}>
              <InfoRow icon="person-outline" label="Username" value={profile?.username || '-'} />
              <InfoRow icon="people-outline" label="Gender" value={capitalizeLabel(profile?.gender)} />
              <InfoRow icon="calendar-outline" label="Age" value={age ? `${age} years` : '-'} />
              <InfoRow
                icon="barbell-outline"
                label="Weight"
                value={toNumber(profile?.weight) > 0 ? `${toNumber(profile.weight).toFixed(1)} kg` : '-'}
              />
              <InfoRow
                icon="resize-outline"
                label="Height"
                value={toNumber(profile?.height) > 0 ? `${Math.round(toNumber(profile.height))} cm` : '-'}
              />
              <InfoRow
                icon="flag-outline"
                label="Weekly Goal"
                value={`${profileSummary.weeklyGoalKm} km`}
                last
              />
            </View>

            <Text style={styles.sectionTitle}>Achievements</Text>
            <View style={styles.badgesWrap}>
              {profileSummary.achievements.map(item => (
                <AchievementBadge
                  key={item.key}
                  icon={item.icon}
                  label={item.label}
                  unlocked={item.unlocked}
                />
              ))}
            </View>

            <Text style={styles.sectionTitle}>Account</Text>
            <View style={styles.sectionCard}>
              <InfoRow icon="mail-outline" label="Email" value={profile?.email || '-'} />
              <InfoRow icon="time-outline" label="Member Since" value={memberSinceText} />
              <InfoRow icon="create-outline" label="Last Updated" value={updatedAtText} last />
            </View>

            <Pressable
              style={[styles.logoutButton, isLoggingOut && styles.logoutDisabled]}
              onPress={handleLogout}
              disabled={isLoggingOut}
            >
              <LinearGradient
                colors={gradients.dangerButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.logoutButtonGradient}
              >
                <Text style={styles.logoutText}>{isLoggingOut ? 'Logging out...' : 'Logout'}</Text>
              </LinearGradient>
            </Pressable>
          </>
        )}
      </ScrollView>

      <BottomTab navigation={navigation} uid={uid} active="Profile" />
    </SafeAreaView>
  );
}

export default withLegacyRoute(ProfileScreen);

function HeroPill({ icon, label }) {
  return (
    <View style={styles.heroPill}>
      <Ionicons name={icon} size={14} color={palette.textSecondary} />
      <Text style={styles.heroPillText}>{label}</Text>
    </View>
  );
}

function ActionTile({ icon, label, subLabel, onPress }) {
  return (
    <Pressable style={styles.actionTile} onPress={onPress}>
      <View style={styles.actionIconWrap}>
        <Ionicons name={icon} size={18} color={palette.accent} />
      </View>
      <Text style={styles.actionLabel}>{label}</Text>
      <Text style={styles.actionSubLabel}>{subLabel}</Text>
    </Pressable>
  );
}

function MetricCard({ icon, label, value }) {
  return (
    <View style={styles.metricCard}>
      <View style={styles.metricTopRow}>
        <Ionicons name={icon} size={17} color={palette.accent} />
        <Text style={styles.metricLabel}>{label}</Text>
      </View>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function GoalInsight({ label, value }) {
  return (
    <View style={styles.goalInsight}>
      <Text style={styles.goalInsightLabel}>{label}</Text>
      <Text style={styles.goalInsightValue}>{value}</Text>
    </View>
  );
}

function RecentRunStat({ label, value }) {
  return (
    <View style={styles.recentStat}>
      <Text style={styles.recentStatLabel}>{label}</Text>
      <Text style={styles.recentStatValue}>{value}</Text>
    </View>
  );
}

function RecordCard({ label, value }) {
  return (
    <View style={styles.recordCard}>
      <Text style={styles.recordTitle}>{label}</Text>
      <Text style={styles.recordValue}>{value}</Text>
    </View>
  );
}

function InfoRow({ icon, label, value, last = false }) {
  return (
    <View style={[styles.infoRow, last && styles.infoRowLast]}>
      <View style={styles.infoLabelRow}>
        <Ionicons name={icon} size={16} color={palette.textMuted} />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function AchievementBadge({ icon, label, unlocked }) {
  return (
    <View style={[styles.badgeItem, unlocked && styles.badgeItemUnlocked]}>
      <Ionicons name={icon} size={16} color={unlocked ? palette.textPrimary : palette.textMuted} />
      <Text style={[styles.badgeText, unlocked && styles.badgeTextUnlocked]}>{label}</Text>
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
    backgroundColor: 'rgba(34,197,94,0.14)',
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
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 120,
  },
  pageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: spacing.sectionGap,
  },
  pageTitle: {
    ...typography.title,
    fontSize: 28,
  },
  pageSubtitle: {
    color: palette.textSecondary,
    marginTop: 4,
    maxWidth: 240,
  },
  headerAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(13,22,39,0.84)',
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: radii.pill,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  headerActionText: {
    color: palette.textPrimary,
    fontWeight: '700',
    fontSize: 12,
  },
  loader: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  heroCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 18,
    marginBottom: 14,
    ...shadows.soft,
  },
  heroTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 66,
    height: 66,
    borderRadius: 33,
    backgroundColor: 'rgba(249,115,22,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  avatarText: {
    color: palette.textPrimary,
    fontWeight: '800',
    fontSize: 24,
  },
  heroInfo: {
    flex: 1,
  },
  name: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  heroSubText: {
    color: palette.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  heroPillsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 16,
  },
  heroPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.18)',
    backgroundColor: 'rgba(13,22,39,0.72)',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  heroPillText: {
    color: palette.textPrimary,
    fontSize: 11,
    fontWeight: '700',
  },
  heroDescription: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 12,
  },
  completionTrack: {
    marginTop: 14,
    height: 8,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  completionFill: {
    height: '100%',
    borderRadius: 999,
    backgroundColor: palette.accent,
  },
  heroMetaText: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 8,
  },
  actionRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  actionTile: {
    flex: 1,
    ...surfaces.card,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 12,
    ...shadows.light,
  },
  actionIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(249,115,22,0.16)',
    marginBottom: 10,
  },
  actionLabel: {
    color: palette.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  actionSubLabel: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 4,
  },
  metricGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 10,
    marginBottom: 14,
  },
  metricCard: {
    width: '48.6%',
    minHeight: 88,
    ...surfaces.card,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...shadows.light,
  },
  metricTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  metricLabel: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  metricValue: {
    color: palette.textPrimary,
    fontWeight: '800',
    fontSize: 20,
    marginTop: 12,
  },
  goalCard: {
    ...surfaces.cardStrong,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 14,
    ...shadows.light,
  },
  goalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  goalTitle: {
    color: palette.textPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  goalSubText: {
    color: palette.textSecondary,
    fontSize: 12,
    marginTop: 4,
  },
  goalEditButton: {
    borderRadius: radii.pill,
    backgroundColor: 'rgba(249,115,22,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  goalEditButtonText: {
    color: '#fdba74',
    fontWeight: '700',
    fontSize: 12,
  },
  goalTrack: {
    marginTop: 14,
    height: 10,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: 999,
  },
  goalInsightRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 16,
  },
  goalInsight: {
    flex: 1,
  },
  goalInsightLabel: {
    color: palette.textMuted,
    fontSize: 11,
  },
  goalInsightValue: {
    color: palette.textPrimary,
    fontSize: 13,
    fontWeight: '700',
    marginTop: 4,
  },
  sectionTitle: {
    ...typography.section,
    marginBottom: 8,
    marginTop: 4,
  },
  sectionCard: {
    ...surfaces.card,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 14,
    ...shadows.light,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionCardTitle: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
  },
  sectionCardSubtitle: {
    color: palette.textMuted,
    fontSize: 11,
    marginTop: 3,
  },
  linkText: {
    color: '#fdba74',
    fontWeight: '700',
    fontSize: 12,
  },
  recentStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 8,
  },
  recentStat: {
    flex: 1,
    backgroundColor: 'rgba(15,23,42,0.68)',
    borderRadius: radii.md,
    padding: 12,
  },
  recentStatLabel: {
    color: palette.textMuted,
    fontSize: 11,
  },
  recentStatValue: {
    color: palette.textPrimary,
    fontWeight: '700',
    fontSize: 13,
    marginTop: 4,
  },
  emptyCard: {
    ...surfaces.card,
    borderRadius: radii.md,
    padding: 18,
    alignItems: 'flex-start',
    marginBottom: 14,
    ...shadows.light,
  },
  emptyTitle: {
    color: palette.textPrimary,
    fontWeight: '800',
    fontSize: 16,
    marginTop: 10,
  },
  emptySubText: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 18,
    marginTop: 6,
  },
  recordsWrap: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 14,
  },
  recordCard: {
    flex: 1,
    ...surfaces.card,
    borderRadius: radii.md,
    paddingVertical: 14,
    paddingHorizontal: 10,
    ...shadows.light,
  },
  recordTitle: {
    color: palette.textMuted,
    fontSize: 11,
    textAlign: 'center',
  },
  recordValue: {
    color: '#fdba74',
    fontSize: 15,
    fontWeight: '800',
    textAlign: 'center',
    marginTop: 8,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148,163,184,0.12)',
  },
  infoRowLast: {
    borderBottomWidth: 0,
    paddingBottom: 0,
  },
  infoLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  infoLabel: {
    color: palette.textMuted,
    fontSize: 12,
  },
  infoValue: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    maxWidth: '48%',
    textAlign: 'right',
  },
  badgesWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 14,
  },
  badgeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(13,22,39,0.62)',
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  badgeItemUnlocked: {
    backgroundColor: 'rgba(249,115,22,0.18)',
    borderColor: 'rgba(249,115,22,0.26)',
  },
  badgeText: {
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  badgeTextUnlocked: {
    color: palette.textPrimary,
  },
  logoutButton: {
    marginTop: 2,
    borderRadius: radii.pill,
    overflow: 'hidden',
    ...shadows.light,
  },
  logoutButtonGradient: {
    height: 50,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoutDisabled: {
    opacity: 0.72,
  },
  logoutText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 15,
    letterSpacing: 0.3,
  },
  errorText: {
    color: '#fca5a5',
    textAlign: 'center',
  },
  errorCard: {
    ...surfaces.card,
    borderRadius: radii.md,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
    gap: 10,
  },
  retryButton: {
    borderRadius: radii.pill,
    backgroundColor: 'rgba(239,68,68,0.14)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  retryButtonText: {
    color: '#fecaca',
    fontSize: 12,
    fontWeight: '700',
  },
});
