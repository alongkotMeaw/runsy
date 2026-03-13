import { Link } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

export default function Tab1Screen() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>Tab 1</Text>
      <Link href="/(tabs)/tab_1/dummy_page" style={styles.link}>
        Go to dummy_page
      </Link>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
  },
  link: {
    fontSize: 16,
    color: '#007AFF',
  },
});
