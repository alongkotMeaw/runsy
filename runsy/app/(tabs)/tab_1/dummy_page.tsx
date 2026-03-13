import { StyleSheet, Text, View } from 'react-native';

export default function DummyPageScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Dummy Page</Text>
      <Text style={styles.subtitle}>This is app/(tabs)/tab_1/dummy_page.tsx</Text>
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
