import { Tabs } from 'expo-router';

export default function TabsLayout() {
  return (
    <Tabs>
      <Tabs.Screen name="index" options={{ title: 'Home' }} />
      <Tabs.Screen
        name="tab_1"
        options={{ title: 'Tab 1', headerShown: false }}
      />
      <Tabs.Screen name="tab_2" options={{ title: 'Tab 2' }} />
    </Tabs>
  );
}
