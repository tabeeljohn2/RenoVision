// screens/RegisterScreen.js
import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { registerUser } from '../api';

export default function RegisterScreen({ navigation }) {
  const [name,     setName]     = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [confirm,  setConfirm]  = useState('');
  const [loading,  setLoading]  = useState(false);

  const handleRegister = async () => {
    // ── Validation ──────────────────────────────────────────────────────
    if (!name.trim() || !email.trim() || !password || !confirm) {
      Alert.alert('Missing Fields', 'Please fill in all fields.');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }
    if (password.length < 6) {
      Alert.alert('Weak Password', 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      Alert.alert('Mismatch', 'Passwords do not match.');
      return;
    }

    setLoading(true);
    try {
      const data = await registerUser(name, email, password);

      if (data.success === true) {
        await AsyncStorage.setItem(
          'renovisionUser',
          JSON.stringify({
            name:        data.user.name,
            email:       data.user.email,
            token:       data.token,
            loginMethod: 'email',
          })
        );
        Alert.alert(
          '✅ Account Created!',
          `Welcome ${data.user.name}!\nYour account has been created successfully.`,
          [{ text: 'Continue', onPress: () => navigation.replace('Home') }]
        );
      } else {
        Alert.alert('Registration Failed', data.error || 'Please try again.');
      }
    } catch (err) {
      if (err.message === 'server_loading') {
        Alert.alert('Backend Loading', 'Server is starting up. Please wait 1–2 minutes and try again.');
      } else if (err.name === 'AbortError') {
        Alert.alert('Timeout', 'Request timed out. Please try again.');
      } else {
        Alert.alert('Error', `Registration failed: ${err.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={styles.logoBox}>
          <Text style={styles.logo}>Reno<Text style={styles.logoGold}>Vision</Text></Text>
          <Text style={styles.logoSub}>Create your free account</Text>
        </View>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Register</Text>

          <Text style={styles.label}>Full Name</Text>
          <TextInput
            style={styles.input} placeholder="Ahmad Raza"
            placeholderTextColor="#555555" value={name}
            onChangeText={setName} autoCorrect={false}
          />

          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input} placeholder="you@example.com"
            placeholderTextColor="#555555" value={email}
            onChangeText={setEmail} keyboardType="email-address"
            autoCapitalize="none" autoCorrect={false}
          />

          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input} placeholder="Minimum 6 characters"
            placeholderTextColor="#555555" value={password}
            onChangeText={setPassword} secureTextEntry autoCapitalize="none"
          />

          <Text style={styles.label}>Confirm Password</Text>
          <TextInput
            style={styles.input} placeholder="Repeat your password"
            placeholderTextColor="#555555" value={confirm}
            onChangeText={setConfirm} secureTextEntry autoCapitalize="none"
          />

          <TouchableOpacity
            style={[styles.btn, loading && styles.btnDisabled]}
            onPress={handleRegister} disabled={loading}
          >
            {loading ? (
              <View style={styles.row}>
                <ActivityIndicator color="#0A0A0A" size="small" />
                <Text style={styles.btnText}>  Creating account...</Text>
              </View>
            ) : (
              <Text style={styles.btnText}>Create Account</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity onPress={() => navigation.navigate('Login')} style={styles.linkBtn}>
            <Text style={styles.linkText}>
              Already have an account?{' '}
              <Text style={styles.linkBold}>Sign in here</Text>
            </Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.footer}>RenoVision — Final Year Project | LGU | BSCS 2026</Text>
        <Text style={styles.footerGold}>Built by Ahmad Raza & Tabeel John</Text>

      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  scroll:    { flexGrow: 1, justifyContent: 'center', padding: 20, paddingBottom: 40 },

  logoBox:  { alignItems: 'center', marginBottom: 28 },
  logo:     { fontSize: 36, fontWeight: '900', color: '#F5F5F0', letterSpacing: -1 },
  logoGold: { color: '#D4AF37' },
  logoSub:  { color: '#888888', fontSize: 13, marginTop: 6 },

  card: {
    backgroundColor: '#1A1A1A', borderRadius: 16,
    padding: 24, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#F5F5F0', marginBottom: 20, textAlign: 'center', letterSpacing: -0.5 },

  label: { fontSize: 14, fontWeight: '600', color: '#F5F5F0', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.2)', borderRadius: 8,
    padding: 12, fontSize: 15, marginBottom: 16, color: '#F5F5F0', backgroundColor: '#222222',
  },

  btn:        { backgroundColor: '#D4AF37', borderRadius: 50, padding: 15, alignItems: 'center', marginTop: 4 },
  btnDisabled:{ backgroundColor: 'rgba(212,175,55,0.4)' },
  btnText:    { color: '#0A0A0A', fontSize: 16, fontWeight: '800' },
  row:        { flexDirection: 'row', alignItems: 'center' },

  linkBtn:  { marginTop: 18, alignItems: 'center' },
  linkText: { color: '#888888', fontSize: 14 },
  linkBold: { color: '#D4AF37', fontWeight: '700' },

  footer:     { textAlign: 'center', color: '#555555', fontSize: 11, marginTop: 24, lineHeight: 16 },
  footerGold: { textAlign: 'center', color: '#D4AF37', fontSize: 11, marginTop: 4, fontWeight: '600' },
});