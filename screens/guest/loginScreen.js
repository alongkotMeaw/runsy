import { View, Text, TextInput, StyleSheet, Pressable, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { ref, get, query, orderByChild, equalTo } from 'firebase/database';
import { auth, database } from '../../firebaseConfig';

export default function LoginScreen({ navigation }) {
  const [showPassword, setShowPassword] = useState(false);
  const [identifier, setIdentifier] = useState(''); 
  const [password, setPassword] = useState('');

  
  const getEmailFromUsername = async (username) => {
    const q = query(
      ref(database, 'users'),
      orderByChild('username'),
      equalTo(username)
    );

    const snapshot = await get(q);
    if (!snapshot.exists()) return null;

    const data = snapshot.val();
    const uid = Object.keys(data)[0];
    return data[uid].email;
  };

  const handleLogin = async () => {
    if (!identifier || !password) {
      Alert.alert('Error', 'กรุณากรอกข้อมูลให้ครบ');
      return;
    }

    try {
      let emailToLogin = identifier;

     
      if (!identifier.includes('@')) {
        const emailFromDB = await getEmailFromUsername(identifier);
        if (!emailFromDB) {
          Alert.alert('Error', 'ไม่พบ username นี้');
          return;
        }
        emailToLogin = emailFromDB;
      }

      const userCredential = await signInWithEmailAndPassword(
        auth,
        emailToLogin,
        password
      );

      const user = userCredential.user;

      navigation.navigate('Dashboard', {
        uid: user.uid,
      });

    } catch (error) {
      Alert.alert('Login failed', 'Email / Username หรือ Password ไม่ถูกต้อง');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <Text style={styles.title}>Welcome Back!</Text>

      <Text style={styles.label}>Email or Username</Text>
      <TextInput
        placeholder="Email or Username"
        style={styles.input}
        autoCapitalize="none"
        value={identifier}
        onChangeText={setIdentifier}
      />

      <Text style={styles.label}>Password</Text>
      <View style={styles.passwordWrapper}>
        <TextInput
          placeholder="Enter your password"
          style={styles.passwordInput}
          secureTextEntry={!showPassword}
          value={password}
          onChangeText={setPassword}
        />
        <Pressable onPress={() => setShowPassword(!showPassword)}>
          <Ionicons
            name={showPassword ? 'eye-off' : 'eye'}
            size={22}
            color="#6b7280"
          />
        </Pressable>
      </View>

      <Pressable style={styles.loginBtn} onPress={handleLogin}>
        <Text style={styles.loginText}>Log in</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
    padding: 24,
    justifyContent: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  label: {
    fontWeight: 'bold',
    marginBottom: 6,
    marginTop: 16,
  },
  input: {
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  passwordWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#d1d5db',
    borderRadius: 10,
    paddingHorizontal: 12,
    height: 48,
  },
  passwordInput: {
    flex: 1,
  },
  loginBtn: {
    backgroundColor: '#3b82f6',
    height: 50,
    borderRadius: 25,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 30,
  },
  loginText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});
