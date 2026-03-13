import { StyleSheet, Text, View } from 'react-native';

export default function Tab2Screen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tab 2</Text>
      <Text style={styles.subtitle}>This is app/(tabs)/tab_2/index.tsx</Text>
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
