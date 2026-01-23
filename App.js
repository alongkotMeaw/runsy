import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Image } from 'react-native';

import HomeScreen from './screens/guest/homeScreen';
import LoginScreen from './screens/guest/loginScreen';
import RegisterScreen from './screens/guest/registerScreen';
import DashBoard from './screens/auth/dashBoard';
import RunScreen from './screens/auth/runScreen';
import HistoryScreen from './screens/auth/historyScreen';
import ProfileScreen from './screens/auth/profileScreen';


const Stack = createNativeStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        <Stack.Screen name="Home" component={HomeScreen} />
        <Stack.Screen name="Login" component={LoginScreen} />
        <Stack.Screen name="Register" component={RegisterScreen} />
        <Stack.Screen name="Dashboard" component={DashBoard} />
        <Stack.Screen name="Run" component={RunScreen} />
        <Stack.Screen name="History" component={HistoryScreen} />
        <Stack.Screen name="Profile" component={ProfileScreen} />
      </Stack.Navigator>
    </NavigationContainer>


    // test image load from local file uri
    // <View>
    //   <Image
    //     source={{
    //       uri: 'file:///data/user/0/host.exp.exponent/files/run-map-1769140052897.jpg',
    //     }}
    //     style={{ width: '90%', height: '80%' }}
    //   />
    // </View>

  );
}
