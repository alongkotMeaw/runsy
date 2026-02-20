import { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { onAuthStateChanged } from 'firebase/auth';
import { LinearGradient } from 'expo-linear-gradient';

import HomeScreen from './screens/guest/homeScreen';
import LoginScreen from './screens/guest/loginScreen';
import RegisterScreen from './screens/guest/registerScreen';
import DashBoard from './screens/auth/dashBoard';
import RunScreen from './screens/auth/runScreen';
import HistoryScreen from './screens/auth/historyScreen';
import ProfileScreen from './screens/auth/profileScreen';
import { auth } from './firebaseConfig';
import { gradients, palette } from './theme/premiumTheme';


const Stack = createNativeStackNavigator();

export default function App() {
  const [currentUser, setCurrentUser] = useState(undefined);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, user => {
      setCurrentUser(user);
    });

    return unsubscribe;
  }, []);

  if (currentUser === undefined) {
    return (
      <View style={styles.loadingContainer}>
        <LinearGradient
          colors={gradients.appBackground}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <ActivityIndicator size="large" color={palette.accent} />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        key={currentUser ? 'auth' : 'guest'}
        screenOptions={{ headerShown: false }}
      >
        {currentUser ? (
          <>
            <Stack.Screen
              name="Dashboard"
              component={DashBoard}
              initialParams={{ uid: currentUser.uid }}
            />
            <Stack.Screen
              name="Run"
              component={RunScreen}
              initialParams={{ uid: currentUser.uid }}
            />
            <Stack.Screen
              name="History"
              component={HistoryScreen}
              initialParams={{ uid: currentUser.uid }}
            />
            <Stack.Screen
              name="Profile"
              component={ProfileScreen}
              initialParams={{ uid: currentUser.uid }}
            />
          </>
        ) : (
          <>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen name="Login" component={LoginScreen} />
            <Stack.Screen name="Register" component={RegisterScreen} />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
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
