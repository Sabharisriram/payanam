import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform
} from 'react-native';
import useAuthStore from '../store/authStore';
import { C } from '../theme/colors';

export default function LoginScreen({ navigation }) {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const { login, isLoading, error } = useAuthStore();

  const handleLogin = async () => {
    if (!phone || !password) {
      Alert.alert('Error', 'Please enter phone and password');
      return;
    }
    await login(phone, password);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <View style={styles.inner}>

        <Text style={styles.logo}>பயணம்</Text>
        <Text style={styles.tagline}>Your Smart Travel Companion</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Phone Number"
          placeholderTextColor={C.INK_MUTED}
          keyboardType="phone-pad"
          value={phone}
          onChangeText={setPhone}
        />

        <TextInput
          style={styles.input}
          placeholder="Password"
          placeholderTextColor={C.INK_MUTED}
          secureTextEntry
          value={password}
          onChangeText={setPassword}
        />

        <TouchableOpacity
          style={styles.button}
          onPress={handleLogin}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Login</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Register')}>
          <Text style={styles.link}>Don't have an account? Register</Text>
        </TouchableOpacity>

      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG },
  inner: { flex: 1, justifyContent: 'center', paddingHorizontal: 28 },
  logo: { fontSize: 42, fontWeight: 'bold', color: C.PRIMARY, textAlign: 'center', marginBottom: 6 },
  tagline: { fontSize: 14, color: C.INK_MUTED, textAlign: 'center', marginBottom: 40 },
  input: {
    backgroundColor: C.CARD, color: C.INK, borderRadius: 10,
    padding: 14, marginBottom: 14, fontSize: 16, borderWidth: 1, borderColor: C.BORDER
  },
  button: {
    backgroundColor: C.PRIMARY, borderRadius: 10,
    padding: 16, alignItems: 'center', marginTop: 6
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: 'bold' },
  link: { color: C.PRIMARY, textAlign: 'center', marginTop: 20, fontSize: 14 },
  error: { color: '#ef4444', textAlign: 'center', marginBottom: 14 }
});