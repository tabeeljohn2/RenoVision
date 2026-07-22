// screens/LoginScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { loginUser, googleAuth, checkHealth } from '../api';

WebBrowser.maybeCompleteAuthSession();

const WEB_CLIENT_ID     = '463989723689-ik6bodnr1tun736pmb9gvbfafafta6vb.apps.googleusercontent.com';
const ANDROID_CLIENT_ID = '463989723689-q5mi2b6kbg8f31kj27jm61p94e07pu97.apps.googleusercontent.com';

export default function LoginScreen({ navigation }) {
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [loading,       setLoading]       = useState(false);
  const [gLoading,      setGLoading]      = useState(false);
  const [backendStatus, setBackendStatus] = useState('checking'); // checking|online|offline

  const [request, response, promptAsync] = Google.useAuthRequest({
    androidClientId: ANDROID_CLIENT_ID,
    webClientId:     WEB_CLIENT_ID,
    scopes:          ['profile', 'email'],
  });

  // ── Check server on mount ──────────────────────────────────────────
  useEffect(() => { pingServer(); }, []);

  // ── Google OAuth response ──────────────────────────────────────────
  useEffect(() => {
    if (response?.type === 'success') {
      handleGoogleSuccess(response);
    } else if (response?.type === 'error') {
      Alert.alert('Google Login Error', 'Google sign-in failed. Please use email login.');
    }
  }, [response]);

  const pingServer = async () => {
    setBackendStatus('checking');
    const h = await checkHealth();
    setBackendStatus(h.online ? (h.ready ? 'online' : 'warming') : 'offline');
  };

  // ── Google login ────────────────────────────────────────────────────
  const handleGoogleSuccess = async (resp) => {
    setGLoading(true);
    try {
      const { authentication } = resp;
      if (!authentication?.accessToken) {
        Alert.alert('Error', 'Failed to get access token.');
        return;
      }

      const userRes  = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${authentication.accessToken}` },
      });
      if (!userRes.ok) throw new Error('Failed to get Google user info');
      const userInfo = await userRes.json();

      const data = await googleAuth(userInfo.name || 'Google User', userInfo.email, userInfo.id);

      if (data.success) {
        await saveUser({ ...data.user, token: data.token, photo: userInfo.picture, loginMethod: 'google' });
        goHome();
      } else {
        Alert.alert('Login Failed', data.error || 'Google login failed');
      }
    } catch (err) {
      Alert.alert('Error', `Google login failed: ${err.message}`);
    } finally {
      setGLoading(false);
    }
  };

  // ── Email login ─────────────────────────────────────────────────────
  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Missing Fields', 'Please enter your email and password.');
      return;
    }
    if (!email.includes('@')) {
      Alert.alert('Invalid Email', 'Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      const data = await loginUser(email, password);

      if (data.success === true) {
        await saveUser({ ...data.user, token: data.token, loginMethod: 'email' });
        goHome();
      } else {
        Alert.alert('Login Failed', data.error || 'Invalid email or password.');
      }
    } catch (err) {
      if (err.message === 'server_loading') {
        Alert.alert('Backend Loading', 'Server is starting up. Please wait 1–2 minutes and try again.');
      } else if (err.name === 'AbortError') {
        Alert.alert('Timeout', 'Server took too long to respond. Please try again.');
      } else {
        Alert.alert('Connection Error', err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const saveUser = async (userObj) => {
    await AsyncStorage.setItem('renovisionUser', JSON.stringify(userObj));
  };

  const goHome = () => navigation.reset({ index: 0, routes: [{ name: 'Home' }] });

  // ── Status bar config ────────────────────────────────────────────────
  const statusConfig = {
    checking: { bg: 'rgba(100,100,100,0.1)', border: 'rgba(100,100,100,0.2)', dot: '#888888', text: '⏳ Checking server...' },
    online:   { bg: 'rgba(52,211,153,0.08)', border: 'rgba(52,211,153,0.25)', dot: '#34d399',  text: '✅ Server is online' },
    warming:  { bg: 'rgba(212,175,55,0.08)', border: 'rgba(212,175,55,0.25)', dot: '#D4AF37',  text: '⏳ Server warming up...' },
    offline:  { bg: 'rgba(239,68,68,0.08)',  border: 'rgba(239,68,68,0.25)',  dot: '#f87171',  text: '🔴 Server offline — tap to retry' },
  };
  const sc = statusConfig[backendStatus];

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>

        {/* Logo */}
        <View style={styles.logoBox}>
          <Text style={styles.logo}>Reno<Text style={styles.logoGold}>Vision</Text></Text>
          <Text style={styles.logoSub}>AI-Based Smart Interior Planner</Text>
        </View>

        {/* Server Status */}
        <TouchableOpacity
          style={[styles.statusBar, { backgroundColor: sc.bg, borderColor: sc.border }]}
          onPress={backendStatus === 'offline' ? pingServer : undefined}
          activeOpacity={backendStatus === 'offline' ? 0.7 : 1}
        >
          <View style={[styles.statusDot, { backgroundColor: sc.dot }]} />
          <Text style={[styles.statusText, { color: sc.dot }]}>{sc.text}</Text>
        </TouchableOpacity>

        {/* Card */}
        <View style={styles.card}>
          <Text style={styles.title}>Sign In</Text>

          {/* Google Button */}
          <TouchableOpacity
            style={[styles.googleBtn, (gLoading || !request) && styles.disabled]}
            onPress={() => promptAsync()}
            disabled={gLoading || !request}
          >
            {gLoading ? (
              <ActivityIndicator color="#D4AF37" size="small" />
            ) : (
              <>
                <View style={styles.googleIcon}>
                  <Text style={styles.googleG}>G</Text>
                </View>
                <Text style={styles.googleText}>Continue with Google</Text>
              </>
            )}
          </TouchableOpacity>

          {/* Divider */}
          <View style={styles.orRow}>
            <View style={styles.orLine} />
            <Text style={styles.orText}>or sign in with email</Text>
            <View style={styles.orLine} />
          </View>

          {/* Email */}
          <Text style={styles.label}>Email Address</Text>
          <TextInput
            style={styles.input}
            placeholder="you@example.com"
            placeholderTextColor="#555555"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
          />

          {/* Password */}
          <Text style={styles.label}>Password</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter your password"
            placeholderTextColor="#555555"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            autoCapitalize="none"
          />

          {/* Login Button */}
          <TouchableOpacity
            style={[styles.btn, loading && styles.btnOff]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <View style={styles.row}>
                <ActivityIndicator color="#0A0A0A" size="small" />
                <Text style={styles.btnText}>  Signing in...</Text>
              </View>
            ) : (
              <Text style={styles.btnText}>Sign In</Text>
            )}
          </TouchableOpacity>

          {/* Register link */}
          <TouchableOpacity onPress={() => navigation.navigate('Register')} style={styles.linkBtn}>
            <Text style={styles.linkText}>
              Don't have an account?{' '}
              <Text style={styles.linkBold}>Register here</Text>
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

  logoBox: { alignItems: 'center', marginBottom: 16 },
  logo:    { fontSize: 36, fontWeight: '900', color: '#F5F5F0', letterSpacing: -1 },
  logoGold:{ color: '#D4AF37' },
  logoSub: { color: '#888888', fontSize: 13, marginTop: 6, textAlign: 'center' },

  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10,
    marginBottom: 14, borderWidth: 1,
  },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },

  card: {
    backgroundColor: '#1A1A1A', borderRadius: 16,
    padding: 24, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#F5F5F0', marginBottom: 20, textAlign: 'center', letterSpacing: -0.5 },

  googleBtn: {
    backgroundColor: '#222222', borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.4)',
    borderRadius: 50, padding: 14, flexDirection: 'row', alignItems: 'center',
    justifyContent: 'center', gap: 12, marginBottom: 16,
  },
  disabled:   { opacity: 0.5 },
  googleIcon: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#D4AF37', alignItems: 'center', justifyContent: 'center' },
  googleG:    { color: '#0A0A0A', fontWeight: '900', fontSize: 16 },
  googleText: { color: '#F5F5F0', fontSize: 15, fontWeight: '600' },

  orRow:  { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 16 },
  orLine: { flex: 1, height: 1, backgroundColor: 'rgba(212,175,55,0.15)' },
  orText: { fontSize: 12, color: '#555555' },

  label: { fontSize: 14, fontWeight: '600', color: '#F5F5F0', marginBottom: 8 },
  input: {
    borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.2)', borderRadius: 8,
    padding: 12, fontSize: 15, marginBottom: 16, color: '#F5F5F0', backgroundColor: '#222222',
  },

  btn:    { backgroundColor: '#D4AF37', borderRadius: 50, padding: 15, alignItems: 'center', marginTop: 4 },
  btnOff: { backgroundColor: 'rgba(212,175,55,0.4)' },
  btnText:{ color: '#0A0A0A', fontSize: 16, fontWeight: '800' },
  row:    { flexDirection: 'row', alignItems: 'center' },

  linkBtn:  { marginTop: 18, alignItems: 'center' },
  linkText: { color: '#888888', fontSize: 14 },
  linkBold: { color: '#D4AF37', fontWeight: '700' },

  footer:     { textAlign: 'center', color: '#555555', fontSize: 11, marginTop: 24, lineHeight: 16 },
  footerGold: { textAlign: 'center', color: '#D4AF37', fontSize: 11, marginTop: 4, fontWeight: '600' },
});