import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs initialRouteName="Dashboard" screenOptions={{ headerShown: false }} tabBar={() => null}>
      <Tabs.Screen name="Dashboard" options={{ title: 'Home' }} />
      <Tabs.Screen name="Run" options={{ title: 'Run' }} />
      <Tabs.Screen name="History" options={{ title: 'History' }} />
      <Tabs.Screen name="Profile" options={{ title: 'Profile' }} />
    </Tabs>
  );
}
