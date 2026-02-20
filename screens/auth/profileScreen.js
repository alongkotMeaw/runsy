import { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
  Alert,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';
import { signOut } from 'firebase/auth';
import { get, ref, update } from 'firebase/database';

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

const formatDateLabel = timestamp => {
  const value = toNumber(timestamp);
  if (!value) return '-';
  return new Date(value).toLocaleDateString();
};

const DEFAULT_WEEKLY_GOAL_KM = 20;

const buildDraftProfile = source => {
  const weight = toNumber(source?.weight);
  const height = toNumber(source?.height);
  const weeklyGoalKm = toNumber(source?.weeklyGoalKm) || DEFAULT_WEEKLY_GOAL_KM;

  return {
    weight: weight > 0 ? String(weight) : '',
    height: height > 0 ? String(height) : '',
    weeklyGoalKm: weeklyGoalKm > 0 ? String(weeklyGoalKm) : String(DEFAULT_WEEKLY_GOAL_KM),
  };
};

const bestSplit = (runs, targetKm) => {
  let bestSeconds = Infinity;

  for (const run of runs) {
    const distance = toNumber(run.distance);
    const time = toNumber(run.time);
    if (distance >= targetKm && distance > 0 && time > 0) {
      const estimatedSeconds = (time / distance) * targetKm;
      if (estimatedSeconds < bestSeconds) {
        bestSeconds = estimatedSeconds;
      }
    }
  }

  return Number.isFinite(bestSeconds) ? formatDuration(bestSeconds) : '--';
};

export default function ProfileScreen({ navigation, route }) {
  const uid = route?.params?.uid || auth.currentUser?.uid || null;

  const [profile, setProfile] = useState(null);
  const [totals, setTotals] = useState({
    runs: 0,
    distance: 0,
    time: 0,
    achievements: 0,
  });
  const [records, setRecords] = useState({
    fiveK: '--',
    tenK: '--',
    half: '--',
  });
  const [loading, setLoading] = useState(true);
  const [errorText, setErrorText] = useState('');
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isSavingProfile, setIsSavingProfile] = useState(false);
  const [draftProfile, setDraftProfile] = useState(() => buildDraftProfile(null));

  const loadProfile = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      setErrorText('User session not found.');
      return;
    }

    setLoading(true);
    setErrorText('');

    try {
      const [userSnap, runsSnap] = await Promise.all([
        get(ref(database, `users/${uid}`)),
        get(ref(database, `users/${uid}/runs`)),
      ]);

      const userData = userSnap.exists() ? userSnap.val() : {};
      const runList = runsSnap.exists() ? Object.values(runsSnap.val()) : [];
      const totalRuns = runList.length;
      const totalDistance = runList.reduce((sum, run) => sum + toNumber(run.distance), 0);
      const totalTime = runList.reduce((sum, run) => sum + toNumber(run.time), 0);

      const achievements = [
        totalRuns >= 1,
        totalRuns >= 10,
        totalDistance >= 50,
        totalDistance >= 100,
      ].filter(Boolean).length;

      setProfile(userData);
      setDraftProfile(buildDraftProfile(userData));
      setIsEditing(false);
      setTotals({
        runs: totalRuns,
        distance: Number(totalDistance.toFixed(2)),
        time: totalTime,
        achievements,
      });
      setRecords({
        fiveK: bestSplit(runList, 5),
        tenK: bestSplit(runList, 10),
        half: bestSplit(runList, 21.1),
      });
    } catch (error) {
      setErrorText('Unable to load profile data.');
    } finally {
      setLoading(false);
    }
  }, [uid]);

  useFocusEffect(
    useCallback(() => {
      loadProfile();
    }, [loadProfile])
  );

  const avatarLabel = useMemo(() => {
    const source = profile?.username || profile?.email || 'R';
    return source.charAt(0).toUpperCase();
  }, [profile?.username, profile?.email]);

  const memberSinceText = useMemo(() => formatDateLabel(profile?.createdAt), [profile?.createdAt]);

  const handleDraftChange = (field, value) => {
    setDraftProfile(prev => ({ ...prev, [field]: value }));
  };

  const handleStartEdit = () => {
    setDraftProfile(buildDraftProfile(profile));
    setIsEditing(true);
  };

  const handleCancelEdit = () => {
    setDraftProfile(buildDraftProfile(profile));
    setIsEditing(false);
  };

  const handleSaveProfile = async () => {
    if (isSavingProfile || !uid) return;

    const weightValue = Number(draftProfile.weight);
    const heightValue = Number(draftProfile.height);
    const weeklyGoalValue = Number(draftProfile.weeklyGoalKm);

    if (!Number.isFinite(weightValue) || weightValue <= 0) {
      Alert.alert('Invalid weight', 'Please enter a valid weight in kg.');
      return;
    }

    if (!Number.isFinite(heightValue) || heightValue <= 0) {
      Alert.alert('Invalid height', 'Please enter a valid height in cm.');
      return;
    }

    if (!Number.isFinite(weeklyGoalValue) || weeklyGoalValue < 1 || weeklyGoalValue > 300) {
      Alert.alert('Invalid goal', 'Weekly goal should be between 1 and 300 km.');
      return;
    }

    const payload = {
      weight: Number(weightValue.toFixed(1)),
      height: Math.round(heightValue),
      weeklyGoalKm: Number(weeklyGoalValue.toFixed(1)),
      updatedAt: Date.now(),
    };

    setIsSavingProfile(true);
    try {
      await update(ref(database, `users/${uid}`), payload);
      setProfile(prev => ({ ...(prev || {}), ...payload }));
      setDraftProfile(buildDraftProfile({ ...(profile || {}), ...payload }));
      setIsEditing(false);
      Alert.alert('Saved', 'Profile updated successfully.');
    } catch (error) {
      Alert.alert('Error', 'Unable to update profile right now.');
    } finally {
      setIsSavingProfile(false);
    }
  };

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

  return (
    <SafeAreaView style={styles.container}>
      <LinearGradient
        colors={gradients.appBackground}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        <LinearGradient colors={gradients.hero} style={styles.headerCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLabel}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.name}>{profile?.username || 'Runner'}</Text>
            <Text style={styles.subText}>{profile?.email || '-'}</Text>
            <Text style={styles.subText}>Member since {memberSinceText}</Text>
          </View>
        </LinearGradient>

        {loading ? (
          <View style={styles.loader}>
            <ActivityIndicator size="small" color={palette.accent} />
          </View>
        ) : (
          <>
            {errorText ? <Text style={styles.errorText}>{errorText}</Text> : null}

            <View style={styles.statsRow}>
              <MetricCard label="Total Runs" value={totals.runs.toString()} />
              <MetricCard label="Distance" value={`${totals.distance} km`} />
              <MetricCard label="Achievements" value={totals.achievements.toString()} />
            </View>

            <Text style={styles.sectionTitle}>Personal Records</Text>
            <RecordRow label="5K Best" value={records.fiveK} />
            <RecordRow label="10K Best" value={records.tenK} />
            <RecordRow label="Half Marathon Best" value={records.half} />

            <View style={styles.accountHeader}>
              <Text style={[styles.sectionTitle, styles.accountHeaderTitle]}>Account</Text>
              {isEditing ? (
                <View style={styles.accountActions}>
                  <Pressable
                    style={styles.actionButtonGhost}
                    onPress={handleCancelEdit}
                    disabled={isSavingProfile}
                  >
                    <Text style={styles.actionButtonGhostText}>Cancel</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.actionButtonPrimary, isSavingProfile && styles.actionButtonDisabled]}
                    onPress={handleSaveProfile}
                    disabled={isSavingProfile}
                  >
                    <Text style={styles.actionButtonPrimaryText}>
                      {isSavingProfile ? 'Saving...' : 'Save'}
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <Pressable style={styles.actionButtonGhost} onPress={handleStartEdit}>
                  <Text style={styles.actionButtonGhostText}>Edit</Text>
                </Pressable>
              )}
            </View>
            <KeyValueRow label="Gender" value={profile?.gender || '-'} />
            {isEditing ? (
              <>
                <EditableValueRow
                  label="Weight"
                  value={draftProfile.weight}
                  onChangeText={text => handleDraftChange('weight', text)}
                  placeholder="65"
                  keyboardType="decimal-pad"
                  suffix="kg"
                />
                <EditableValueRow
                  label="Height"
                  value={draftProfile.height}
                  onChangeText={text => handleDraftChange('height', text)}
                  placeholder="170"
                  keyboardType="number-pad"
                  suffix="cm"
                />
                <EditableValueRow
                  label="Weekly Goal"
                  value={draftProfile.weeklyGoalKm}
                  onChangeText={text => handleDraftChange('weeklyGoalKm', text)}
                  placeholder="20"
                  keyboardType="decimal-pad"
                  suffix="km"
                />
              </>
            ) : (
              <>
                <KeyValueRow label="Weight" value={profile?.weight ? `${profile.weight} kg` : '-'} />
                <KeyValueRow label="Height" value={profile?.height ? `${profile.height} cm` : '-'} />
                <KeyValueRow
                  label="Weekly Goal"
                  value={profile?.weeklyGoalKm ? `${profile.weeklyGoalKm} km` : '-'}
                />
              </>
            )}
            <KeyValueRow
              label="Birth Date"
              value={profile?.birthDate ? new Date(profile.birthDate).toLocaleDateString() : '-'}
            />
            <KeyValueRow label="Total Run Time" value={formatDuration(totals.time)} />

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

function MetricCard({ label, value }) {
  return (
    <View style={styles.statBox}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

function RecordRow({ label, value }) {
  return (
    <View style={styles.recordItem}>
      <Text style={styles.recordTitle}>{label}</Text>
      <Text style={styles.recordValue}>{value}</Text>
    </View>
  );
}

function KeyValueRow({ label, value }) {
  return (
    <View style={styles.settingItem}>
      <Text style={styles.settingLabel}>{label}</Text>
      <Text style={styles.settingText}>{value}</Text>
    </View>
  );
}

function EditableValueRow({ label, value, onChangeText, placeholder, keyboardType, suffix }) {
  return (
    <View style={styles.settingItem}>
      <Text style={styles.settingLabel}>{label}</Text>
      <View style={styles.editableInputWrap}>
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={palette.textMuted}
          keyboardType={keyboardType}
          style={styles.editableInput}
        />
        <Text style={styles.editableSuffix}>{suffix}</Text>
      </View>
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
  content: {
    flex: 1,
  },
  contentContainer: {
    paddingBottom: 120,
  },
  headerCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    padding: 16,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    ...shadows.soft,
  },
  avatar: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(249,115,22,0.24)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: palette.textPrimary,
    fontWeight: '800',
    fontSize: 22,
  },
  headerInfo: {
    flex: 1,
  },
  name: {
    color: palette.textPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  subText: {
    color: palette.textSecondary,
    fontSize: 12,
    marginTop: 2,
  },
  loader: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  statBox: {
    flex: 1,
    ...surfaces.card,
    borderRadius: radii.md,
    paddingVertical: 12,
    paddingHorizontal: 8,
    ...shadows.light,
  },
  statLabel: {
    color: palette.textMuted,
    fontSize: 11,
  },
  statValue: {
    color: palette.textPrimary,
    fontWeight: '700',
    fontSize: 14,
    marginTop: 2,
  },
  sectionTitle: {
    ...typography.section,
    marginBottom: 8,
    marginTop: 4,
  },
  accountHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
  },
  accountHeaderTitle: {
    marginTop: 0,
    marginBottom: 0,
  },
  accountActions: {
    flexDirection: 'row',
    gap: 8,
  },
  actionButtonGhost: {
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: 'rgba(148,163,184,0.14)',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  actionButtonGhostText: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
  },
  actionButtonPrimary: {
    borderRadius: radii.pill,
    backgroundColor: palette.accent,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  actionButtonPrimaryText: {
    color: '#0f172a',
    fontSize: 12,
    fontWeight: '800',
  },
  actionButtonDisabled: {
    opacity: 0.7,
  },
  recordItem: {
    ...surfaces.card,
    borderRadius: radii.md,
    padding: 13,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.light,
  },
  recordTitle: {
    color: palette.textPrimary,
    fontWeight: '700',
    fontSize: 13,
  },
  recordValue: {
    color: '#fdba74',
    fontSize: 13,
    fontWeight: '700',
  },
  settingItem: {
    ...surfaces.card,
    borderRadius: radii.md,
    padding: 13,
    marginBottom: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    ...shadows.light,
  },
  settingLabel: {
    color: palette.textMuted,
    fontSize: 12,
  },
  settingText: {
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  editableInputWrap: {
    minWidth: 120,
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: 'rgba(15,23,42,0.58)',
    paddingHorizontal: 10,
    paddingVertical: 0,
  },
  editableInput: {
    minWidth: 56,
    color: palette.textPrimary,
    fontSize: 12,
    fontWeight: '700',
    paddingVertical: 8,
    textAlign: 'right',
  },
  editableSuffix: {
    marginLeft: 6,
    color: palette.textMuted,
    fontSize: 11,
    fontWeight: '700',
  },
  logoutButton: {
    marginTop: 12,
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
    marginBottom: 12,
    textAlign: 'center',
  },
});
