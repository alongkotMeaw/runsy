import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  Alert,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { equalTo, get, orderByChild, query, ref, update } from 'firebase/database';

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

const toNumber = value => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

const calculateCompletion = form => {
  const checks = [
    Boolean(form.username.trim()),
    Boolean(form.email.trim()),
    Boolean(form.gender),
    toNumber(form.weight) > 0,
    toNumber(form.height) > 0,
    Boolean(form.birthDate),
    toNumber(form.weeklyGoalKm) > 0,
  ];

  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
};

const calculateAge = birthDate => {
  if (!(birthDate instanceof Date) || Number.isNaN(birthDate.getTime())) return null;

  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  const dayDiff = today.getDate() - birthDate.getDate();

  if (monthDiff < 0 || (monthDiff === 0 && dayDiff < 0)) {
    age -= 1;
  }

  return age >= 0 ? age : null;
};

const findUsernameOwner = async username => {
  const normalized = username.toLowerCase();
  const [legacySnap, normalizedSnap] = await Promise.all([
    get(query(ref(database, 'users'), orderByChild('username'), equalTo(username))),
    get(query(ref(database, 'users'), orderByChild('usernameLower'), equalTo(normalized))),
  ]);

  const collectOwnerIds = snapshot =>
    snapshot.exists() ? Object.keys(snapshot.val() || {}) : [];

  return [...new Set([...collectOwnerIds(legacySnap), ...collectOwnerIds(normalizedSnap)])];
};

export default function EditProfileScreen({ navigation, route }) {
  const uid = route?.params?.uid || auth.currentUser?.uid || null;

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [form, setForm] = useState({
    username: '',
    email: '',
    gender: '',
    weight: '',
    height: '',
    birthDate: null,
    weeklyGoalKm: '',
  });

  const loadProfile = useCallback(async () => {
    if (!uid) {
      setLoading(false);
      Alert.alert('Error', 'User session not found.');
      navigation.goBack();
      return;
    }

    setLoading(true);
    setLoadError('');

    try {
      const snapshot = await get(ref(database, `users/${uid}`));
      const user = snapshot.exists() ? snapshot.val() : {};

      setForm({
        username: user?.username || '',
        email: user?.email || auth.currentUser?.email || '',
        gender: user?.gender || '',
        weight: user?.weight ? `${user.weight}` : '',
        height: user?.height ? `${user.height}` : '',
        birthDate: user?.birthDate ? new Date(user.birthDate) : null,
        weeklyGoalKm: user?.weeklyGoalKm ? `${user.weeklyGoalKm}` : `${DEFAULT_WEEKLY_GOAL_KM}`,
      });
    } catch (error) {
      setLoadError('Unable to load profile. Pull back in once your connection is stable.');
    } finally {
      setLoading(false);
    }
  }, [navigation, uid]);

  useEffect(() => {
    loadProfile();
  }, [loadProfile]);

  const setField = (key, value) => {
    setForm(current => ({
      ...current,
      [key]: value,
    }));
  };

  const completionPct = useMemo(() => calculateCompletion(form), [form]);
  const agePreview = useMemo(() => calculateAge(form.birthDate), [form.birthDate]);

  const handleSave = async () => {
    if (saving || !uid) return;

    const username = form.username.trim();
    const gender = form.gender;
    const weight = toNumber(form.weight);
    const height = toNumber(form.height);
    const weeklyGoalKm = toNumber(form.weeklyGoalKm);
    const birthDate = form.birthDate;

    if (!username || username.length < 3) {
      Alert.alert('Invalid username', 'Username should be at least 3 characters.');
      return;
    }

    if (!gender) {
      Alert.alert('Missing info', 'Please select your gender.');
      return;
    }

    if (weight <= 0) {
      Alert.alert('Invalid weight', 'Please enter a valid weight in kg.');
      return;
    }

    if (height <= 0) {
      Alert.alert('Invalid height', 'Please enter a valid height in cm.');
      return;
    }

    if (weeklyGoalKm < 1) {
      Alert.alert('Invalid goal', 'Weekly goal should be at least 1 km.');
      return;
    }

    if (!birthDate) {
      Alert.alert('Missing info', 'Please select your birth date.');
      return;
    }

    if (birthDate.getTime() > Date.now()) {
      Alert.alert('Invalid date', 'Birth date cannot be in the future.');
      return;
    }

    setSaving(true);

    try {
      const ownerIds = await findUsernameOwner(username);
      const otherOwnerExists = ownerIds.some(ownerId => ownerId !== uid);
      if (otherOwnerExists) {
        Alert.alert('Username taken', 'Please choose another username.');
        setSaving(false);
        return;
      }

      await update(ref(database, `users/${uid}`), {
        username,
        usernameLower: username.toLowerCase(),
        gender,
        weight: Number(weight.toFixed(1)),
        height: Math.round(height),
        birthDate: birthDate.toISOString(),
        weeklyGoalKm: Math.round(weeklyGoalKm),
        updatedAt: Date.now(),
      });

      Alert.alert('Saved', 'Profile updated successfully.', [
        {
          text: 'OK',
          onPress: () => navigation.goBack(),
        },
      ]);
    } catch (error) {
      Alert.alert('Error', 'Unable to save profile right now.');
    } finally {
      setSaving(false);
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

      <KeyboardAvoidingView
        style={styles.keyboardWrap}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.headerRow}>
            <Pressable style={styles.backButton} onPress={() => navigation.goBack()}>
              <Ionicons name="chevron-back" size={20} color={palette.textPrimary} />
            </Pressable>
            <Text style={styles.headerTitle}>Edit Profile</Text>
            <Pressable
              style={[styles.saveChip, saving && styles.saveChipDisabled]}
              onPress={handleSave}
              disabled={saving || loading}
            >
              <Text style={styles.saveChipText}>Save</Text>
            </Pressable>
          </View>

          {loading ? (
            <View style={styles.loaderWrap}>
              <ActivityIndicator size="small" color={palette.accent} />
            </View>
          ) : (
            <>
              <LinearGradient colors={gradients.hero} style={styles.heroCard}>
                <Text style={styles.heroTitle}>Keep your runner profile current</Text>
                <Text style={styles.heroSubText}>
                  These details power goal tracking, calorie estimates, and the profile overview.
                </Text>
                <View style={styles.heroStatsRow}>
                  <HeroStat label="Completion" value={`${completionPct}%`} />
                  <HeroStat label="Age" value={agePreview ? `${agePreview}` : '--'} />
                  <HeroStat label="Goal" value={`${toNumber(form.weeklyGoalKm) || DEFAULT_WEEKLY_GOAL_KM} km`} />
                </View>
              </LinearGradient>

              {loadError ? (
                <View style={styles.errorCard}>
                  <Text style={styles.errorText}>{loadError}</Text>
                  <Pressable style={styles.retryButton} onPress={loadProfile}>
                    <Text style={styles.retryButtonText}>Retry Load</Text>
                  </Pressable>
                </View>
              ) : null}

              <LinearGradient colors={['rgba(249,115,22,0.14)', 'rgba(13,22,39,0.06)']} style={styles.tipCard}>
                <View style={styles.tipIconWrap}>
                  <Ionicons name="sparkles-outline" size={18} color="#fdba74" />
                </View>
                <View style={styles.tipContent}>
                  <Text style={styles.tipTitle}>Profile quality matters</Text>
                  <Text style={styles.tipText}>
                    Accurate weight, height, and weekly goal make your calorie and progress summaries more reliable.
                  </Text>
                </View>
              </LinearGradient>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Personal</Text>
                <Label text="Email" />
                <View style={[styles.inputWrap, styles.inputDisabled]}>
                  <Ionicons name="mail-outline" size={18} color={palette.textMuted} />
                  <Text style={styles.staticValue}>{form.email || '-'}</Text>
                </View>

                <Label text="Username" />
                <InputRow
                  icon="person-outline"
                  value={form.username}
                  onChangeText={value => setField('username', value)}
                  placeholder="Your username"
                />

                <Label text="Gender" />
                <View style={styles.pickerBox}>
                  <Picker
                    selectedValue={form.gender}
                    onValueChange={value => setField('gender', value)}
                    dropdownIconColor={palette.textSecondary}
                    style={styles.picker}
                  >
                    <Picker.Item label="Select gender" value="" />
                    <Picker.Item label="Male" value="male" />
                    <Picker.Item label="Female" value="female" />
                    <Picker.Item label="Prefer not to say" value="unspecified" />
                  </Picker>
                </View>

                <Label text="Birth Date" />
                <Pressable style={styles.dateButton} onPress={() => setShowDatePicker(true)}>
                  <Ionicons name="calendar-outline" size={18} color={palette.textMuted} />
                  <Text style={styles.dateText}>
                    {form.birthDate ? form.birthDate.toDateString() : 'Select date of birth'}
                  </Text>
                </Pressable>
              </View>

              <View style={styles.sectionCard}>
                <Text style={styles.sectionTitle}>Training Data</Text>
                <View style={styles.doubleRow}>
                  <View style={styles.doubleCol}>
                    <Label text="Weight (kg)" />
                    <InputRow
                      icon="barbell-outline"
                      value={form.weight}
                      onChangeText={value => setField('weight', value)}
                      placeholder="65"
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.doubleCol}>
                    <Label text="Height (cm)" />
                    <InputRow
                      icon="resize-outline"
                      value={form.height}
                      onChangeText={value => setField('height', value)}
                      placeholder="170"
                      keyboardType="numeric"
                    />
                  </View>
                </View>

                <Label text="Weekly Goal (km)" />
                <InputRow
                  icon="flag-outline"
                  value={form.weeklyGoalKm}
                  onChangeText={value => setField('weeklyGoalKm', value)}
                  placeholder="20"
                  keyboardType="numeric"
                />
              </View>

              <Pressable
                style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                onPress={handleSave}
                disabled={saving}
              >
                <LinearGradient
                  colors={gradients.accentButton}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.saveButtonGradient}
                >
                  {saving ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.saveButtonText}>Save Changes</Text>
                  )}
                </LinearGradient>
              </Pressable>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {showDatePicker ? (
        <DateTimePicker
          value={form.birthDate || new Date(2000, 0, 1)}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          maximumDate={new Date()}
          onChange={(event, selectedDate) => {
            if (Platform.OS !== 'ios') {
              setShowDatePicker(false);
            }

            if (selectedDate) {
              setField('birthDate', selectedDate);
            }
          }}
        />
      ) : null}
    </SafeAreaView>
  );
}

function Label({ text }) {
  return <Text style={styles.label}>{text}</Text>;
}

function InputRow({ icon, ...props }) {
  return (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color={palette.textMuted} />
      <TextInput
        placeholderTextColor={palette.textMuted}
        style={styles.input}
        autoCapitalize="none"
        {...props}
      />
    </View>
  );
}

function HeroStat({ label, value }) {
  return (
    <View style={styles.heroStat}>
      <Text style={styles.heroStatLabel}>{label}</Text>
      <Text style={styles.heroStatValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bgBase,
  },
  keyboardWrap: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingTop: spacing.screenTop,
    paddingBottom: 32,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: 'rgba(13,22,39,0.84)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    ...typography.section,
    fontSize: 18,
  },
  saveChip: {
    borderRadius: radii.pill,
    backgroundColor: 'rgba(249,115,22,0.16)',
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  saveChipDisabled: {
    opacity: 0.6,
  },
  saveChipText: {
    color: '#fdba74',
    fontSize: 12,
    fontWeight: '700',
  },
  loaderWrap: {
    paddingVertical: 28,
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
  heroTitle: {
    color: palette.textPrimary,
    fontSize: 22,
    fontWeight: '800',
  },
  heroSubText: {
    color: palette.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginTop: 8,
  },
  heroStatsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
  },
  heroStat: {
    flex: 1,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.16)',
    backgroundColor: 'rgba(13,22,39,0.58)',
    paddingVertical: 10,
    paddingHorizontal: 10,
  },
  heroStatLabel: {
    color: palette.textMuted,
    fontSize: 10,
    fontWeight: '700',
  },
  heroStatValue: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '800',
    marginTop: 6,
  },
  errorCard: {
    ...surfaces.card,
    borderRadius: radii.lg,
    padding: 14,
    marginBottom: 14,
    alignItems: 'center',
    gap: 10,
  },
  errorText: {
    color: '#fca5a5',
    textAlign: 'center',
    fontSize: 13,
    lineHeight: 18,
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
  tipCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(249,115,22,0.16)',
    flexDirection: 'row',
    gap: 12,
    padding: 14,
    marginBottom: 14,
  },
  tipIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(249,115,22,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  tipContent: {
    flex: 1,
  },
  tipTitle: {
    color: palette.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  tipText: {
    color: palette.textSecondary,
    fontSize: 12,
    lineHeight: 18,
    marginTop: 4,
  },
  sectionCard: {
    ...surfaces.card,
    borderRadius: radii.lg,
    padding: 16,
    marginBottom: 14,
    ...shadows.light,
  },
  sectionTitle: {
    ...typography.section,
    marginBottom: 10,
  },
  label: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
    marginBottom: 6,
  },
  inputWrap: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    backgroundColor: 'rgba(15,23,42,0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  inputDisabled: {
    opacity: 0.8,
  },
  input: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 14,
  },
  staticValue: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 14,
  },
  pickerBox: {
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    borderRadius: radii.md,
    backgroundColor: 'rgba(15,23,42,0.84)',
    overflow: 'hidden',
  },
  picker: {
    color: palette.textPrimary,
  },
  dateButton: {
    height: 50,
    borderWidth: 1,
    borderColor: 'rgba(148,163,184,0.24)',
    borderRadius: radii.md,
    backgroundColor: 'rgba(15,23,42,0.84)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    color: palette.textPrimary,
    fontSize: 14,
  },
  doubleRow: {
    flexDirection: 'row',
    gap: 10,
  },
  doubleCol: {
    flex: 1,
  },
  saveButton: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    marginTop: 6,
    ...shadows.light,
  },
  saveButtonDisabled: {
    opacity: 0.7,
  },
  saveButtonGradient: {
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: {
    color: '#fff',
    fontWeight: '800',
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
