import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView
} from 'react-native';
import useAuthStore from '../store/authStore';
import { C } from '../theme/colors';

export default function RegisterScreen({ navigation }) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { register, isLoading, error } = useAuthStore();

  const handleRegister = async () => {
    if (!name || !phone || !password) {
      Alert.alert('Error', 'Name, phone and password are required');
      return;
    }
    await register(name, phone, email, password);
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView contentContainerStyle={styles.inner}>

        <Text style={styles.logo}>பயணம்</Text>
        <Text style={styles.tagline}>Create your account</Text>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <TextInput
          style={styles.input}
          placeholder="Full Name"
          placeholderTextColor={C.INK_MUTED}
          value={name}
          onChangeText={setName}
        />

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
          placeholder="Email (optional)"
          placeholderTextColor={C.INK_MUTED}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
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
          onPress={handleRegister}
          disabled={isLoading}
        >
          {isLoading
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.buttonText}>Create Account</Text>
          }
        </TouchableOpacity>

        <TouchableOpacity onPress={() => navigation.navigate('Login')}>
          <Text style={styles.link}>Already have an account? Login</Text>
        </TouchableOpacity>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.BG },
  inner: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 28, paddingVertical: 40 },
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