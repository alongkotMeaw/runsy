import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack } from 'expo-router';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { auth } from '../firebaseConfig';
import { gradients, palette } from '../theme/premiumTheme';

export default function RootLayout() {
  const [currentUser, setCurrentUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
    });

    return unsubscribe;
  }, []);

  return (
    <SafeAreaProvider>
      {currentUser === undefined ? (
        <View style={styles.loadingContainer}>
          <LinearGradient
            colors={gradients.appBackground as [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <ActivityIndicator size="large" color={palette.accent} />
        </View>
      ) : (
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Protected guard={Boolean(currentUser)}>
            <Stack.Screen name="(tabs)" />
          </Stack.Protected>
          <Stack.Protected guard={!currentUser}>
            <Stack.Screen name="(guest)" />
          </Stack.Protected>
        </Stack>
      )}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: palette.bgBase,
  },
});
