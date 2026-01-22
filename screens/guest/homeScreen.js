import { StatusBar } from 'expo-status-bar';
import { View, Text, StyleSheet, ImageBackground, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';




export default function Home({ navigation }) {
  return (
    <SafeAreaView style={{ flex: 1 }}>
      <View style={{ flex: 7 }}>
          <ImageBackground
           source={require('../../assets/Appscreen.png')}
            style={styles.bg}
          > </ImageBackground>
      </View>

      {/* interact   */}
      <View style={{ flex: 4 }}>
        <View style={styles.overlay} />

        <View style={styles.content}>
          <Text style={styles.title}>RUNNING CLUB</Text>
          <Text style={styles.subtitle}>Train together. Go further.</Text>

          <Pressable style={styles.joinBtn}
           onPress={() => navigation.navigate('Register')}
          >
            <Text style={styles.joinText}>Join Us</Text>
          </Pressable>

          <Pressable style={styles.loginBtn}
           onPress={() => navigation.navigate('Login')}
          >
            <Text style={styles.loginText}>Log in</Text>
          </Pressable>
        </View>

        <StatusBar style="light" />
      </View>
     
    </SafeAreaView>
  );
}


const styles = StyleSheet.create({
  bg: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  content: {
    padding: 24,
  },
  title: {
    color: '#fff',
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    color: '#d1d5db',
    fontSize: 14,
    marginBottom: 24,
  },
  joinBtn: {
    backgroundColor: '#f97316',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  joinText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
  loginBtn: {
    height: 50,
    borderRadius: 25,
    borderWidth: 1.5,
    borderColor: '#f97316',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loginText: {
    color: '#f97316',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
