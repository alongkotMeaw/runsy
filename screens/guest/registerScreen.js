import { View, Text, TextInput, Pressable, Alert, Platform } from 'react-native';
import { ref, set, get, query, orderByChild, equalTo } from 'firebase/database';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { auth, database } from '../../firebaseConfig';
import { Picker } from '@react-native-picker/picker';
import DateTimePicker from '@react-native-community/datetimepicker';

export default function RegisterScreen({ navigation }) {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const [gender, setGender] = useState('');
  const [weight, setWeight] = useState('');
  const [height, setHeight] = useState('');

  const [birthDate, setBirthDate] = useState(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  //check username has taken
  const isUsernameTaken = async (username) => {
   const q = query(
     ref(database, 'users'),
     orderByChild('username'),
     equalTo(username)
   );

   const snapshot = await get(q);
   return snapshot.exists(); 
  };

  const handleRegister = async () => {
  if (
    !username || !email || !password ||
    !gender || !weight || !height || !birthDate
  ) {
    Alert.alert('Error', 'กรุณากรอกข้อมูลให้ครบ');
    return;
  }

  try {
    const taken = await isUsernameTaken(username);
    if (taken) {
      Alert.alert('Error', 'Username นี้ถูกใช้แล้ว');
      return;
    }

    const userCredential =
      await createUserWithEmailAndPassword(auth, email, password);

    const user = userCredential.user;

    await set(ref(database, 'users/' + user.uid), {
      username,
      email: user.email,
      gender,
      weight: Number(weight),
      height: Number(height),
      birthDate: birthDate.toISOString(),
      createdAt: Date.now(),
    });

    Alert.alert('Success', 'สมัครสมาชิกสำเร็จ', [
      {
        text: 'OK',
        onPress: () => navigation.replace('Home')
      }
    ]);

  } catch (error) {
    Alert.alert('Error', error.message);
  }
};


  // UI 
  return (
    
    <SafeAreaView style={{ flex:1, padding:20 }}>
      <Text style={styles.title}>Register</Text>

      <Text>Email</Text>
      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
      />

      <Text>Username</Text>
      <TextInput style={styles.input} value={username} onChangeText={setUsername} />
  
      <Text>Password</Text>
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        secureTextEntry
      />

      <Text>Gender</Text>
      <View style={styles.pickerBox}>
        <Picker
          selectedValue={gender}
          onValueChange={setGender}
        >
          <Picker.Item label="เลือกเพศ" value="" />
          <Picker.Item label="male" value="male" />
          <Picker.Item label="female" value="female" />
        </Picker>
      </View>

      <Text>Weight (kg)</Text>
      <TextInput
        style={styles.input}
        value={weight}
        onChangeText={setWeight}
        keyboardType="numeric"
      />

      <Text>Height (cm)</Text>
      <TextInput
        style={styles.input}
        value={height}
        onChangeText={setHeight}
        keyboardType="numeric"
      />

      <Text>Birth Date</Text>
      <Pressable
        style={styles.dateBtn}
        onPress={() => setShowDatePicker(true)}
      >
        <Text>
          {birthDate
            ? birthDate.toDateString()
            : 'เลือกวันเกิด'}
        </Text>
      </Pressable>

      {showDatePicker && (
        <DateTimePicker
          value={birthDate || new Date()}
          mode="date"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          onChange={(event, selectedDate) => {
            setShowDatePicker(false);
            if (selectedDate) setBirthDate(selectedDate);
          }}
          maximumDate={new Date()}
        />
      )}

      <Pressable style={styles.button} onPress={handleRegister}>
        <Text style={{ color:'#fff' }}>Register</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const styles = {
  title: {
    fontSize:24,
    fontWeight:'bold',
    marginBottom:20
  },
  input: {
    borderWidth:1,
    borderRadius:8,
    padding:10,
    marginBottom:12
  },
  pickerBox: {
    borderWidth:1,
    borderRadius:8,
    marginBottom:12
  },
  dateBtn: {
    borderWidth:1,
    borderRadius:8,
    padding:12,
    marginBottom:15
  },
  button: {
    backgroundColor:'#000',
    padding:15,
    borderRadius:8,
    alignItems:'center'
  }
};
