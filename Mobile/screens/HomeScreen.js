// screens/HomeScreen.js
import React, { useState, useEffect, useCallback } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet,
  ScrollView, Alert, RefreshControl,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { checkHealth } from '../api';

export default function HomeScreen({ navigation }) {
  const [user,          setUser]          = useState(null);
  const [backendStatus, setBackendStatus] = useState('checking'); // checking | online | offline
  const [hasHistory,    setHasHistory]    = useState(false);
  const [refreshing,    setRefreshing]    = useState(false);

  useEffect(() => {
    loadUser();
    pingBackend();
    checkHistory();

    // Re-check backend every 30s while on this screen
    const interval = setInterval(pingBackend, 30000);
    return () => clearInterval(interval);
  }, []);

  // Re-check history when navigating back from Results
  useEffect(() => {
    const unsub = navigation.addListener('focus', checkHistory);
    return unsub;
  }, [navigation]);

  const loadUser = async () => {
    try {
      const saved = await AsyncStorage.getItem('renovisionUser');
      if (saved) setUser(JSON.parse(saved));
    } catch (e) {
      console.error('Load user error:', e);
    }
  };

  const pingBackend = async () => {
    setBackendStatus('checking');
    const health = await checkHealth();
    setBackendStatus(health.online ? (health.ready ? 'online' : 'warming') : 'offline');
  };

  const checkHistory = async () => {
    try {
      const saved = await AsyncStorage.getItem('renovisionResults');
      setHasHistory(!!saved);
    } catch { /* ignore */ }
  };

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await pingBackend();
    await checkHistory();
    setRefreshing(false);
  }, []);

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out', style: 'destructive',
        onPress: async () => {
          try {
            await AsyncStorage.removeItem('renovisionUser');
            navigation.reset({ index: 0, routes: [{ name: 'Login' }] });
          } catch (e) {
            console.error('Logout error:', e);
          }
        },
      },
    ]);
  };

  const statusColor = {
    checking: '#888888',
    online:   '#34d399',
    warming:  '#D4AF37',
    offline:  '#f87171',
  };

  const statusLabel = {
    checking: '⏳ Checking backend...',
    online:   '✅ Backend is online',
    warming:  '⏳ Backend warming up...',
    offline:  '🔴 Backend offline — tap to retry',
  };

  const STEPS = [
    { icon: '📸', title: 'Upload Indoor Room Photo',     desc: 'Take or select a clear photo of your room' },
    { icon: '👁️', title: 'YOLO Room Analysis',           desc: 'AI detects furniture and room type with high accuracy' },
    { icon: '💡', title: 'Smart XAI Recommendations',    desc: 'Get personalized renovation suggestions with cost estimates' },
    { icon: '🎨', title: 'SD + LoRA Design Preview',     desc: 'See an AI-generated redesign based on your style & budget' },
  ];

  return (
    <ScrollView
      style={styles.container}
      showsVerticalScrollIndicator={false}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#D4AF37" />}
    >
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.logo}>Reno<Text style={styles.logoGold}>Vision</Text></Text>
          <Text style={styles.headerSub}>AI Interior Planner</Text>
        </View>
        <TouchableOpacity onPress={handleLogout} style={styles.logoutBtn}>
          <Text style={styles.logoutText}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* ── Backend Status Bar ── */}
      <TouchableOpacity
        style={[styles.statusBar, { borderColor: statusColor[backendStatus] + '55' }]}
        onPress={backendStatus === 'offline' ? pingBackend : undefined}
        activeOpacity={backendStatus === 'offline' ? 0.7 : 1}
      >
        <View style={[styles.statusDot, { backgroundColor: statusColor[backendStatus] }]} />
        <Text style={[styles.statusText, { color: statusColor[backendStatus] }]}>
          {statusLabel[backendStatus]}
        </Text>
      </TouchableOpacity>

      {/* ── Welcome Box ── */}
      <View style={styles.welcomeBox}>
        <Text style={styles.welcomeHi}>Welcome back! 👋</Text>
        <Text style={styles.welcomeName}>{user?.name || 'User'}</Text>
        <Text style={styles.welcomeEmail}>{user?.email || ''}</Text>
        <Text style={styles.welcomeSub}>Ready to plan your renovation?</Text>
      </View>

      {/* ── Action Buttons ── */}
      <TouchableOpacity
        style={[styles.startBtn, backendStatus === 'offline' && styles.startBtnDim]}
        onPress={() => navigation.navigate('Upload')}
      >
        <Text style={styles.startBtnText}>📸  Start Planning Now</Text>
      </TouchableOpacity>

      {hasHistory && (
        <TouchableOpacity
          style={styles.historyBtn}
          onPress={() => navigation.navigate('Results')}
        >
          <Text style={styles.historyBtnText}>📋  View Last Results</Text>
        </TouchableOpacity>
      )}

      {/* ── How It Works ── */}
      <Text style={styles.sectionTitle}>How It Works</Text>
      {STEPS.map((item, i) => (
        <View key={i} style={styles.featureCard}>
          <View style={styles.featureStep}>
            <Text style={styles.featureStepNum}>{i + 1}</Text>
          </View>
          <View style={styles.featureIconBox}>
            <Text style={styles.featureIcon}>{item.icon}</Text>
          </View>
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>{item.title}</Text>
            <Text style={styles.featureDesc}>{item.desc}</Text>
          </View>
        </View>
      ))}

      {/* ── Disclaimer ── */}
      <View style={styles.disclaimer}>
        <Text style={styles.disclaimerText}>
          ⚠️ <Text style={{ fontWeight: '700', color: '#D4AF37' }}>Indoor photos only.</Text>
          {' '}Outdoor images will be rejected by the YOLO model.
          All recommendations are advisory only.
        </Text>
      </View>

      {/* ── Footer ── */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>RenoVision — Final Year Project</Text>
        <Text style={styles.footerText}>Lahore Garrison University | BSCS 2026</Text>
        <Text style={styles.footerGold}>Built by Ahmad Raza & Tabeel John</Text>
      </View>

      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0A0A0A' },

  // Header
  header: {
    backgroundColor: '#111111', padding: 20, paddingTop: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  logo:       { fontSize: 22, fontWeight: '900', color: '#F5F5F0', letterSpacing: -0.5 },
  logoGold:   { color: '#D4AF37' },
  headerSub:  { color: '#888888', fontSize: 12, marginTop: 2 },
  logoutBtn: {
    backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)', paddingVertical: 8,
    paddingHorizontal: 14, borderRadius: 50,
  },
  logoutText: { color: '#D4AF37', fontSize: 13, fontWeight: '600' },

  // Status bar
  statusBar: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    marginHorizontal: 16, marginTop: 14, marginBottom: 2,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 9,
  },
  statusDot:  { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '600' },

  // Welcome
  welcomeBox: {
    backgroundColor: '#1A1A1A', margin: 16, marginTop: 12,
    padding: 20, borderRadius: 16, borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.15)',
  },
  welcomeHi:    { fontSize: 14, color: '#888888' },
  welcomeName:  { fontSize: 26, fontWeight: '900', color: '#D4AF37', marginTop: 4, letterSpacing: -0.5 },
  welcomeEmail: { fontSize: 12, color: '#555555', marginBottom: 4 },
  welcomeSub:   { fontSize: 14, color: '#888888' },

  // Buttons
  startBtn: {
    backgroundColor: '#D4AF37', marginHorizontal: 16,
    marginBottom: 10, padding: 18, borderRadius: 50, alignItems: 'center',
  },
  startBtnDim:  { opacity: 0.5 },
  startBtnText: { color: '#0A0A0A', fontSize: 17, fontWeight: '800' },
  historyBtn: {
    backgroundColor: 'rgba(212,175,55,0.1)', marginHorizontal: 16,
    marginBottom: 16, padding: 14, borderRadius: 50, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
  },
  historyBtnText: { color: '#D4AF37', fontSize: 15, fontWeight: '700' },

  // Steps
  sectionTitle: {
    fontSize: 18, fontWeight: '800', color: '#F5F5F0',
    marginHorizontal: 16, marginBottom: 12, letterSpacing: -0.3,
  },
  featureCard: {
    backgroundColor: '#1A1A1A', marginHorizontal: 16, marginBottom: 10,
    padding: 14, borderRadius: 14, flexDirection: 'row', alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.12)', gap: 12,
  },
  featureStep: {
    width: 22, height: 22, borderRadius: 11, backgroundColor: '#D4AF37',
    alignItems: 'center', justifyContent: 'center',
  },
  featureStepNum: { color: '#0A0A0A', fontSize: 11, fontWeight: '900' },
  featureIconBox: {
    width: 44, height: 44, backgroundColor: 'rgba(212,175,55,0.1)',
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 12, alignItems: 'center', justifyContent: 'center',
  },
  featureIcon:  { fontSize: 20 },
  featureText:  { flex: 1 },
  featureTitle: { fontSize: 13, fontWeight: '700', color: '#F5F5F0', marginBottom: 2 },
  featureDesc:  { fontSize: 12, color: '#888888', lineHeight: 17 },

  // Disclaimer
  disclaimer: {
    backgroundColor: 'rgba(212,175,55,0.05)', marginHorizontal: 16,
    padding: 14, borderRadius: 12, borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)', marginTop: 4,
  },
  disclaimerText: { fontSize: 12, color: '#888888', lineHeight: 18 },

  // Footer
  footer: {
    alignItems: 'center', marginHorizontal: 16, marginTop: 20,
    paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.1)',
  },
  footerText: { fontSize: 11, color: '#555555', textAlign: 'center', marginBottom: 3 },
  footerGold: { fontSize: 11, color: '#D4AF37', textAlign: 'center', fontWeight: '600' },
});