import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ImageBackground, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';

import {
  gradients,
  palette,
  radii,
  shadows,
  spacing,
  surfaces,
  typography,
} from '../../theme/premiumTheme';

export default function Home({ navigation }) {
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      <ImageBackground
        source={require('../../assets/Appscreen.png')}
        style={styles.heroImage}
        imageStyle={styles.heroImageStyle}
      >
        <LinearGradient
          colors={['rgba(0,0,0,0.06)', 'rgba(2,6,23,0.84)', 'rgba(2,6,23,0.98)']}
          style={StyleSheet.absoluteFill}
        />

        <View style={styles.content}>
          <Text style={styles.kicker}>RUNSY CLUB</Text>
          <Text style={styles.title}>Run smarter. Track every stride.</Text>
          <Text style={styles.subtitle}>
            Precision route tracking, clear progress, and a premium training
            experience.
          </Text>

          <View style={styles.actions}>
            <Pressable style={styles.primaryButton} onPress={() => navigation.navigate('Register')}>
              <LinearGradient
                colors={gradients.accentButton}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.primaryButtonGradient}
              >
                <Text style={styles.primaryButtonText}>Create Account</Text>
              </LinearGradient>
            </Pressable>

            <Pressable style={styles.secondaryButton} onPress={() => navigation.navigate('Login')}>
              <Text style={styles.secondaryButtonText}>I already have an account</Text>
            </Pressable>
          </View>
        </View>
      </ImageBackground>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: palette.bgBase,
  },
  heroImage: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  heroImageStyle: {
    resizeMode: 'cover',
  },
  content: {
    paddingHorizontal: spacing.screenHorizontal,
    paddingBottom: 42,
    gap: 10,
  },
  kicker: {
    color: '#fde68a',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.4,
  },
  title: {
    ...typography.title,
    fontSize: 34,
    lineHeight: 40,
    maxWidth: '92%',
  },
  subtitle: {
    color: palette.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    maxWidth: '95%',
  },
  actions: {
    marginTop: 14,
    gap: 12,
  },
  primaryButton: {
    borderRadius: radii.pill,
    overflow: 'hidden',
    ...shadows.soft,
  },
  primaryButtonGradient: {
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 0.3,
  },
  secondaryButton: {
    height: 56,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: palette.borderSoft,
    backgroundColor: surfaces.card.backgroundColor,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryButtonText: {
    color: palette.textPrimary,
    fontSize: 15,
    fontWeight: '700',
  },
});
