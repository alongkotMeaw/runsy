import { StyleSheet, Text, View } from 'react-native';

export default function HomeTabScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tabs Home</Text>
      <Text style={styles.subtitle}>This is app/(tabs)/index.tsx</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
  },
});
