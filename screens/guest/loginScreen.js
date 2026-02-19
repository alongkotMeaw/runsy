import { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';

import { auth, database } from '../../firebaseConfig';
import {
  gradients,
  palette,
  radii,
  shadows,
  spacing,
  typography,
} from '../../theme/premiumTheme';

const getLoginErrorMessage = code => {
  switch (code) {
    case 'auth/invalid-credential':
      return 'Invalid email/username or password.';
    case 'auth/user-disabled':
      return 'This account has been disabled.';
    case 'auth/too-many-requests':
      return 'Too many attempts. Please try again later.';
    default:
      return 'Unable to log in right now.';
  }
};

export default function LoginScreen({ navigation }) {
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const getEmailFromUsername = async username => {
    const normalized = username.toLowerCase();

    const [legacySnap, normalizedSnap] = await Promise.all([
      get(query(ref(database, 'users'), orderByChild('username'), equalTo(username))),
      get(
        query(
          ref(database, 'users'),
          orderByChild('usernameLower'),
          equalTo(normalized)
        )
      ),
    ]);

    const snapshot = normalizedSnap.exists() ? normalizedSnap : legacySnap;
    if (!snapshot.exists()) return null;

    const data = snapshot.val();
    const uid = Object.keys(data)[0];
    return data[uid]?.email || null;
  };

  const handleLogin = async () => {
    if (isSubmitting) return;

    const normalizedIdentifier = identifier.trim();
    const normalizedPassword = password.trim();

    if (!normalizedIdentifier || !normalizedPassword) {
      Alert.alert('Missing info', 'Please enter your login and password.');
      return;
    }

    setIsSubmitting(true);

    try {
      let emailToLogin = normalizedIdentifier;

      if (!normalizedIdentifier.includes('@')) {
        const emailFromDB = await getEmailFromUsername(normalizedIdentifier);
        if (!emailFromDB) {
          Alert.alert('Login failed', 'Username was not found.');
          return;
        }
        emailToLogin = emailFromDB;
      }

      await signInWithEmailAndPassword(auth, emailToLogin, normalizedPassword);
    } catch (error) {
      Alert.alert('Login failed', getLoginErrorMessage(error?.code));
    } finally {
      setIsSubmitting(false);
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
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.headerWrap}>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in and continue your running journey.</Text>
          </View>

          <View style={styles.formCard}>
            <Text style={styles.label}>Email or Username</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="person-outline" size={18} color={palette.textMuted} />
              <TextInput
                placeholder="Email or Username"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                autoCapitalize="none"
                value={identifier}
                onChangeText={setIdentifier}
              />
            </View>

            <Text style={styles.label}>Password</Text>
            <View style={styles.inputWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={palette.textMuted} />
              <TextInput
                placeholder="Enter your password"
                placeholderTextColor={palette.textMuted}
                style={styles.input}
                secureTextEntry={!showPassword}
                value={password}
                onChangeText={setPassword}
                autoCapitalize="none"
              />
              <Pressable onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? 'eye-off-outline' : 'eye-outline'}
                  size={20}
                  color={palette.textMuted}
                />
              </Pressable>
            </View>

            <Pressable
              style={[styles.loginBtn, isSubmitting && styles.loginBtnDisabled]}
              onPress={handleLogin}
              disabled={isSubmitting}
            >
              <LinearGradient
                colors={gradients.accentButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.loginBtnGradient}
              >
                {isSubmitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.loginText}>Log in</Text>
                )}
              </LinearGradient>
            </Pressable>

            <Pressable onPress={() => navigation.navigate('Register')}>
              <Text style={styles.footerLink}>
                New here? Create account
              </Text>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: spacing.screenHorizontal,
    paddingVertical: 28,
  },
  headerWrap: {
    marginBottom: 16,
  },
  title: {
    ...typography.title,
    fontSize: 32,
  },
  subtitle: {
    color: palette.textSecondary,
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  formCard: {
    backgroundColor: 'rgba(12, 20, 35, 0.86)',
    borderWidth: 1,
    borderColor: palette.borderSoft,
    borderRadius: radii.lg,
    padding: 16,
    gap: 10,
    ...shadows.soft,
  },
  label: {
    color: palette.textSecondary,
    fontSize: 12,
    fontWeight: '700',
    marginTop: 2,
  },
  inputWrap: {
    height: 50,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.26)',
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
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
  loginBtn: {
    marginTop: 8,
    borderRadius: radii.pill,
    overflow: 'hidden',
  },
  loginBtnGradient: {
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnDisabled: {
    opacity: 0.75,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  footerLink: {
    textAlign: 'center',
    color: '#fdba74',
    fontWeight: '600',
    marginTop: 8,
    fontSize: 13,
  },
});
