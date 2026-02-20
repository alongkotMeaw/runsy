import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  Alert,
  Platform,
  StyleSheet,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ref, set, get, query, orderByChild, equalTo } from 'firebase/database';
import { createUserWithEmailAndPassword, deleteUser } from 'firebase/auth';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { auth, database, firebaseSetup } from '../../firebaseConfig';
import {
  gradients,
  palette,
  radii,
  shadows,
  spacing,
  typography,
} from '../../theme/premiumTheme';

const DEFAULT_WEEKLY_GOAL_KM = 20;

const isPermissionDeniedError = error =>
  error?.code === 'PERMISSION_DENIED' || error?.code === 'auth/permission-denied';

const getRegisterErrorMessage = error => {
  const code = error?.code;

  switch (code) {
    case 'auth/email-already-in-use':
      return 'This email is already in use.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters.';
    case 'auth/network-request-failed':
      return 'Network error. Check your internet connection.';
    case 'auth/operation-not-allowed':
      return 'Email/Password sign-in is disabled in Firebase Authentication.';
    case 'auth/missing-api-key':
    case 'auth/invalid-api-key':
    case 'auth/configuration-not-found':
      return 'Firebase config is missing or invalid in this build.';
    case 'PERMISSION_DENIED':
      return 'Database rules blocked this request. Check Realtime Database rules.';
    default:
      return code
        ? `Unable to create account right now (${code}).`
        : 'Unable to create account right now.';
  }
};

const getErrorDetails = error => {
  const code = error?.code || 'unknown';
  const message = typeof error?.message === 'string' ? error.message : '';
  return message ? `\n\nCode: ${code}\nDetail: ${message}` : `\n\nCode: ${code}`;
};

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');
  const [birthDate, setBirthDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isUsernameTaken = async nextUsername => {
    const normalized = nextUsername.toLowerCase();

    const [legacySnap, normalizedSnap] = await Promise.all([
      get(query(ref(database, 'users'), orderByChild('username'), equalTo(nextUsername))),
      get(
        query(
          ref(database, 'users'),
          orderByChild('usernameLower'),
          equalTo(normalized)
        )
      ),
    ]);

    return legacySnap.exists() || normalizedSnap.exists();
  };

  const handleRegister = async () => {
    if (isSubmitting) return;

    if (!firebaseSetup.isConfigured) {
      Alert.alert(
        'Firebase config missing',
        `Missing env vars: ${firebaseSetup.missingEnvVars.join(', ')}`
      );
      return;
    }

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedPassword = password.trim();
    const parsedWeight = Number(weight);
    const parsedHeight = Number(height);

    if (!normalizedUsername || !normalizedEmail || !normalizedPassword || !gender || !birthDate) {
      Alert.alert('Missing info', 'Please complete all required fields.');
      return;
    }

    if (!normalizedEmail.includes('@')) {
      Alert.alert('Invalid email', 'Please enter a valid email address.');
      return;
    }

    if (!Number.isFinite(parsedWeight) || parsedWeight <= 0) {
      Alert.alert('Invalid weight', 'Please enter a valid weight in kg.');
      return;
    }

    if (!Number.isFinite(parsedHeight) || parsedHeight <= 0) {
      Alert.alert('Invalid height', 'Please enter a valid height in cm.');
      return;
    }

    if (normalizedPassword.length < 6) {
      Alert.alert('Weak password', 'Password should be at least 6 characters.');
      return;
    }

    setIsSubmitting(true);

    let createdUser = null;
    let retryUsernameCheckAfterAuth = false;

    try {
      try {
        const taken = await isUsernameTaken(normalizedUsername);
        if (taken) {
          Alert.alert('Username taken', 'Please choose another username.');
          return;
        }
      } catch (usernameError) {
        if (!isPermissionDeniedError(usernameError)) {
          throw usernameError;
        }
        retryUsernameCheckAfterAuth = true;
      }

      const userCredential = await createUserWithEmailAndPassword(
        auth,
        normalizedEmail,
        normalizedPassword
      );
      createdUser = userCredential.user;

      if (retryUsernameCheckAfterAuth) {
        try {
          const takenAfterAuth = await isUsernameTaken(normalizedUsername);
          if (takenAfterAuth) {
            await deleteUser(createdUser);
            Alert.alert('Username taken', 'Please choose another username.');
            return;
          }
        } catch (usernameErrorAfterAuth) {
          if (!isPermissionDeniedError(usernameErrorAfterAuth)) {
            throw usernameErrorAfterAuth;
          }
        }
      }

      await set(ref(database, `users/${createdUser.uid}`), {
        username: normalizedUsername,
        usernameLower: normalizedUsername.toLowerCase(),
        email: createdUser.email,
        gender,
        weight: Number(parsedWeight.toFixed(1)),
        height: Math.round(parsedHeight),
        birthDate: birthDate.toISOString(),
        weeklyGoalKm: DEFAULT_WEEKLY_GOAL_KM,
        createdAt: Date.now(),
      });

      Alert.alert('Success', 'Account created successfully.');
    } catch (error) {
      if (createdUser && isPermissionDeniedError(error)) {
        try {
          await deleteUser(createdUser);
        } catch {
          // Keep the main error visible; rollback can fail on weak networks.
        }
      }

      console.error('[RegisterScreen] Register failed', error);
      Alert.alert('Error', `${getRegisterErrorMessage(error)}${getErrorDetails(error)}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const inputWithIcon = (icon, placeholder, value, onChangeText, options = {}) => (
    <View style={styles.inputWrap}>
      <Ionicons name={icon} size={18} color={palette.textMuted} />
      <TextInput
        placeholder={placeholder}
        placeholderTextColor={palette.textMuted}
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        {...options}
      />
    </View>
  );

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
          <Text style={styles.title}>Create Account</Text>
          <Text style={styles.subtitle}>Set your profile once, then focus on the run.</Text>

          <View style={styles.formCard}>
            <Text style={styles.label}>Email</Text>
            {inputWithIcon('mail-outline', 'name@email.com', email, setEmail, {
              autoCapitalize: 'none',
              keyboardType: 'email-address',
            })}

            <Text style={styles.label}>Username</Text>
            {inputWithIcon('person-outline', 'Your username', username, setUsername, {
              autoCapitalize: 'none',
            })}

            <Text style={styles.label}>Password</Text>
            {inputWithIcon('lock-closed-outline', 'At least 6 characters', password, setPassword, {
              autoCapitalize: 'none',
              secureTextEntry: true,
            })}

            <Text style={styles.label}>Gender</Text>
            <View style={styles.pickerBox}>
              <Picker
                selectedValue={gender}
                onValueChange={setGender}
                dropdownIconColor={palette.textSecondary}
                style={styles.picker}
              >
                <Picker.Item label="Select gender" value="" />
                <Picker.Item label="Male" value="male" />
                <Picker.Item label="Female" value="female" />
                <Picker.Item label="Prefer not to say" value="unspecified" />
              </Picker>
            </View>

            <View style={styles.doubleRow}>
              <View style={styles.doubleCol}>
                <Text style={styles.label}>Weight (kg)</Text>
                {inputWithIcon('barbell-outline', '65', weight, setWeight, {
                  keyboardType: 'numeric',
                })}
              </View>

              <View style={styles.doubleCol}>
                <Text style={styles.label}>Height (cm)</Text>
                {inputWithIcon('resize-outline', '170', height, setHeight, {
                  keyboardType: 'numeric',
                })}
              </View>
            </View>

            <Text style={styles.label}>Birth Date</Text>
            <Pressable style={styles.dateBtn} onPress={() => setShowDatePicker(true)}>
              <Ionicons name="calendar-outline" size={18} color={palette.textMuted} />
              <Text style={styles.dateText}>
                {birthDate ? birthDate.toDateString() : 'Select date of birth'}
              </Text>
            </Pressable>

            {showDatePicker ? (
              <DateTimePicker
                value={birthDate || new Date()}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                onChange={(event, selectedDate) => {
                  setShowDatePicker(false);
                  if (selectedDate) {
                    setBirthDate(selectedDate);
                  }
                }}
                maximumDate={new Date()}
              />
            ) : null}

            <Pressable
              style={[styles.button, isSubmitting && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={isSubmitting}
            >
              <LinearGradient
                colors={gradients.accentButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.buttonGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.buttonText}>Register</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Login')}>
              <Text style={styles.footerLink}>Already have an account? Log in</Text>
            </Pressable>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
  title: {
    ...typography.title,
    fontSize: 30,
  },
  subtitle: {
    color: palette.textSecondary,
    marginBottom: 8,
  },
  formCard: {
    backgroundColor: 'rgba(12, 20, 35, 0.86)',
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: radii.lg,
    padding: 16,
    gap: 8,
    ...shadows.soft,
  },
  label: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 4,
  },
  inputWrap: {
    height: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    backgroundColor: 'rgba(15, 23, 42, 0.84)',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
  },
  input: {
    flex: 1,
    color: palette.textPrimary,
    fontSize: 14,
  },
  pickerBox: {
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    borderRadius: radii.md,
    backgroundColor: 'rgba(15, 23, 42, 0.84)',
    overflow: 'hidden',
  },
  picker: {
    color: palette.textPrimary,
  },
  doubleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  doubleCol: {
    flex: 1,
  },
  dateBtn: {
    height: 48,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.24)',
    borderRadius: radii.md,
    backgroundColor: 'rgba(15, 23, 42, 0.84)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  dateText: {
    color: palette.textPrimary,
    fontSize: 14,
  },
  button: {
    marginTop: 8,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  buttonGradient: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.75,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '800',
    letterSpacing: 0.3,
    fontSize: 16,
  },
  footerLink: {
    textAlign: 'center',
    color: '#fdba74',
    fontWeight: '600',
    marginTop: 6,
    fontSize: 13,
  },
});
