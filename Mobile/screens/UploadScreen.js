// screens/UploadScreen.js
import React, { useState } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Image,
  Alert, ActivityIndicator, ScrollView, TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { analyzeRoom } from '../api';

const STYLES = ['modern', 'classic', 'minimalist', 'natural'];
const STYLE_ICONS = { modern: '🏙️', classic: '🏛️', minimalist: '⬜', natural: '🌿' };

const QUICK_BUDGETS = [
  { label: '10K',  value: 10000    },
  { label: '25K',  value: 25000    },
  { label: '50K',  value: 50000    },
  { label: '1L',   value: 100000   },
  { label: '5L',   value: 500000   },
  { label: '10L',  value: 1000000  },
  { label: '50L',  value: 5000000  },
  { label: '1Cr',  value: 10000000 },
];

// ── Real pipeline stage labels matching backend flow ──────────────────
const PIPELINE_STAGES = [
  { delay: 0,     msg: '🔌 Connecting to backend...' },
  { delay: 3000,  msg: '📸 Image uploaded — running YOLO detection...' },
  { delay: 14000, msg: '🧠 YOLO done — generating XAI recommendations...' },
  { delay: 22000, msg: '🎨 Recommendations ready — generating SD design...' },
  { delay: 55000, msg: '⏳ Still generating image, please wait...' },
  { delay: 100000,msg: '⏳ Almost done — large image may take a moment...' },
];

export default function UploadScreen({ navigation }) {
  const [image,        setImage]        = useState(null);
  const [budget,       setBudget]       = useState(50000);
  const [customBudget, setCustomBudget] = useState('');
  const [useCustom,    setUseCustom]    = useState(false);
  const [style,        setStyle]        = useState('modern');
  const [userPrompt,   setUserPrompt]   = useState('');
  const [loading,      setLoading]      = useState(false);
  const [loadingMsg,   setLoadingMsg]   = useState('');

  const actualBudget = useCustom ? (parseInt(customBudget, 10) || 0) : budget;

  // ── Image Picker ─────────────────────────────────────────────────────
  const pickImage = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Needed', 'Please allow photo access in Settings.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true, aspect: [4, 3], quality: 0.75,
    });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Permission Needed', 'Please allow camera access in Settings.');
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true, aspect: [4, 3], quality: 0.75,
    });
    if (!result.canceled && result.assets[0]) setImage(result.assets[0].uri);
  };

  // ── Analyze ───────────────────────────────────────────────────────────
  const handleAnalyze = async () => {
    if (!image) {
      Alert.alert('No Image', 'Please select or take a room photo first.');
      return;
    }
    if (actualBudget < 5000) {
      Alert.alert('Invalid Budget', 'Minimum budget is Rs. 5,000.');
      return;
    }

    // Read session
    let user;
    try {
      const raw = await AsyncStorage.getItem('renovisionUser');
      if (!raw) throw new Error('no_session');
      user = JSON.parse(raw);
      if (!user?.token) throw new Error('no_token');
    } catch {
      Alert.alert('Session Expired', 'Please login again.', [
        { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) },
      ]);
      return;
    }

    setLoading(true);

    // ── Schedule stage messages matching backend pipeline ───────────────
    const timers = PIPELINE_STAGES.map(({ delay, msg }) =>
      setTimeout(() => setLoadingMsg(msg), delay)
    );
    const clearTimers = () => timers.forEach(clearTimeout);

    try {
      const results = await analyzeRoom(
        image,
        actualBudget,
        style,
        user.token,
        userPrompt || '',
        (msg) => setLoadingMsg(msg)   // status callback from api.js
      );

      clearTimers();

      if (!results) {
        Alert.alert('Empty Response', 'Server returned no data. Please try again.');
        return;
      }

      // Save and navigate
      await AsyncStorage.setItem('renovisionResults', JSON.stringify({
        ...results,
        user_prompt: userPrompt || '',
      }));
      await AsyncStorage.setItem('renovisionImage', image);

      navigation.navigate('Results');

    } catch (err) {
      clearTimers();

      const msg = err.message || '';

      if (msg === 'outdoor_scene') {
        Alert.alert(
          '🚫 Outdoor Image Detected',
          'RenoVision only works with indoor room photos.\n\nPlease upload a photo taken inside your home.',
          [{ text: 'OK' }]
        );
      } else if (msg.startsWith('401') || msg.includes('login')) {
        Alert.alert('Session Expired', 'Please login again.', [
          { text: 'OK', onPress: () => navigation.reset({ index: 0, routes: [{ name: 'Login' }] }) },
        ]);
      } else if (msg.includes('timed out') || err.name === 'AbortError') {
        Alert.alert('⏱️ Timeout', 'Analysis took too long.\n\nThe GPU backend may have been busy. Please try again.');
      } else if (msg.includes('wake') || msg.includes('warming')) {
        Alert.alert('⏳ Backend Starting', 'The backend GPU is still loading.\n\nPlease wait 30 seconds and try again.');
      } else if (msg.includes('Network') || msg.includes('fetch')) {
        Alert.alert('🌐 Network Error', 'Could not reach the backend.\n\nCheck your internet connection and try again.');
      } else {
        Alert.alert('Analysis Failed', msg || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
      setLoadingMsg('');
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Plan Renovation</Text>
        <View style={{ width: 60 }} />
      </View>

      {/* ── Loading Overlay ── */}
      {loading && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color="#D4AF37" />
            <Text style={styles.loadingTitle}>Analyzing Room</Text>
            <Text style={styles.loadingStep}>{loadingMsg}</Text>

            {/* Pipeline steps visual */}
            <View style={styles.pipelineRow}>
              {['YOLO', 'XAI', 'SD+LoRA'].map((step, i) => {
                const active =
                  (i === 0 && loadingMsg.includes('YOLO')) ||
                  (i === 1 && loadingMsg.includes('XAI')) ||
                  (i === 2 && (loadingMsg.includes('SD') || loadingMsg.includes('image')));
                return (
                  <React.Fragment key={step}>
                    <View style={[styles.pipelineStep, active && styles.pipelineStepActive]}>
                      <Text style={[styles.pipelineLabel, active && styles.pipelineLabelActive]}>{step}</Text>
                    </View>
                    {i < 2 && <View style={styles.pipelineLine} />}
                  </React.Fragment>
                );
              })}
            </View>

            <Text style={styles.loadingNote}>
              Keep the app open.{'\n'}Image generation takes 30–90s on GPU.
            </Text>
          </View>
        </View>
      )}

      <View style={styles.content}>

        {/* Indoor Warning */}
        <View style={styles.warningBanner}>
          <Text style={styles.warningText}>
            ⚠️ <Text style={styles.warningBold}>Indoor photos only.</Text>
            {' '}Outdoor images will be rejected by YOLO.
          </Text>
        </View>

        {/* ── Image Section ── */}
        <Text style={styles.sectionLabel}>📸 Room Photo</Text>
        {image ? (
          <View>
            <Image source={{ uri: image }} style={styles.previewImg} resizeMode="cover" />
            <View style={styles.imgBtnRow}>
              <TouchableOpacity style={styles.changeBtn} onPress={pickImage}>
                <Text style={styles.changeBtnText}>Change Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.changeBtn, styles.removeBtnBorder]} onPress={() => setImage(null)}>
                <Text style={styles.removeBtnText}>Remove</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.imageBtns}>
            <TouchableOpacity style={styles.imageBtn} onPress={takePhoto}>
              <Text style={styles.imageBtnIcon}>📷</Text>
              <Text style={styles.imageBtnText}>Take Photo</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.imageBtn} onPress={pickImage}>
              <Text style={styles.imageBtnIcon}>🖼️</Text>
              <Text style={styles.imageBtnText}>Choose Photo</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── Budget Section ── */}
        <View style={styles.budgetSection}>
          <Text style={styles.sectionLabel}>
            💰 Budget: <Text style={styles.goldText}>Rs. {actualBudget.toLocaleString()}</Text>
          </Text>

          <View style={styles.toggleRow}>
            <TouchableOpacity
              style={[styles.toggleBtn, !useCustom && styles.toggleBtnActive]}
              onPress={() => setUseCustom(false)}
            >
              <Text style={[styles.toggleText, !useCustom && styles.toggleTextActive]}>Quick Select</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.toggleBtn, useCustom && styles.toggleBtnActive]}
              onPress={() => setUseCustom(true)}
            >
              <Text style={[styles.toggleText, useCustom && styles.toggleTextActive]}>Custom Amount</Text>
            </TouchableOpacity>
          </View>

          {!useCustom ? (
            <View style={styles.quickBudgets}>
              {QUICK_BUDGETS.map((b) => (
                <TouchableOpacity
                  key={b.value}
                  style={[styles.quickBtn, budget === b.value && styles.quickBtnActive]}
                  onPress={() => setBudget(b.value)}
                >
                  <Text style={[styles.quickBtnText, budget === b.value && styles.quickBtnTextActive]}>
                    {b.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View>
              <View style={styles.customRow}>
                <Text style={styles.rsLabel}>Rs.</Text>
                <TextInput
                  style={styles.customInput}
                  placeholder="Enter amount"
                  placeholderTextColor="#555555"
                  value={customBudget}
                  onChangeText={setCustomBudget}
                  keyboardType="numeric"
                />
              </View>
              <Text style={styles.minNote}>Minimum Rs. 5,000</Text>
            </View>
          )}
        </View>

        {/* ── Style Section ── */}
        <Text style={styles.sectionLabel}>🎨 Design Style</Text>
        <View style={styles.styleBtns}>
          {STYLES.map((s) => (
            <TouchableOpacity
              key={s}
              style={[styles.styleBtn, style === s && styles.styleBtnActive]}
              onPress={() => setStyle(s)}
            >
              <Text style={styles.styleIcon}>{STYLE_ICONS[s]}</Text>
              <Text style={[styles.styleBtnText, style === s && styles.styleBtnTextActive]}>
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ── Custom Prompt ── */}
        <View style={styles.promptSection}>
          <Text style={styles.sectionLabel}>
            ✍️ Custom Request <Text style={styles.optional}>(Optional)</Text>
          </Text>
          <TextInput
            style={styles.promptInput}
            placeholder="e.g. 'cozy bedroom with warm lighting and wooden furniture'"
            placeholderTextColor="#555555"
            value={userPrompt}
            onChangeText={setUserPrompt}
            multiline maxLength={300}
            textAlignVertical="top"
          />
          <Text style={styles.charCount}>{userPrompt.length}/300</Text>
        </View>

        {/* ── Summary ── */}
        <View style={styles.summaryCard}>
          {[
            ['Budget',  `Rs. ${actualBudget.toLocaleString()}`],
            ['Style',   style.charAt(0).toUpperCase() + style.slice(1)],
            ['Image',   image ? '✅ Ready' : '❌ Not selected'],
          ].map(([label, value]) => (
            <View key={label} style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>{label}</Text>
              <Text style={styles.summaryValue}>{value}</Text>
            </View>
          ))}
          {userPrompt.trim() !== '' && (
            <View style={styles.summaryRow}>
              <Text style={styles.summaryLabel}>Custom Request</Text>
              <Text style={[styles.summaryValue, { color: '#D4AF37' }]}>✅ Added</Text>
            </View>
          )}
        </View>

        {/* ── Analyze Button ── */}
        <TouchableOpacity
          style={[styles.analyzeBtn, (!image || loading) && styles.analyzeBtnDisabled]}
          onPress={handleAnalyze}
          disabled={loading || !image}
        >
          <Text style={styles.analyzeBtnText}>
            {loading ? '⏳ Analyzing...' : '🚀 Analyze My Room'}
          </Text>
        </TouchableOpacity>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>RenoVision — Final Year Project | LGU | BSCS 2026</Text>
          <Text style={styles.footerGold}>Built by Ahmad Raza & Tabeel John</Text>
        </View>

      </View>
      <View style={{ height: 50 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0A0A0A' },
  header: {
    backgroundColor: '#111111', padding: 16, paddingTop: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  backBtn:     { width: 60 },
  backText:    { color: '#D4AF37', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#F5F5F0', fontSize: 17, fontWeight: '700' },
  content:     { padding: 16 },

  // Loading overlay
  loadingOverlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.92)', alignItems: 'center',
    justifyContent: 'center', zIndex: 9999,
  },
  loadingBox: {
    backgroundColor: '#1A1A1A', borderRadius: 20, padding: 32,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
    width: '88%', maxWidth: 330,
  },
  loadingTitle: { color: '#F5F5F0', fontSize: 20, fontWeight: '800', marginTop: 18, marginBottom: 8 },
  loadingStep:  { color: '#D4AF37', fontSize: 13, fontWeight: '600', textAlign: 'center', marginBottom: 16, lineHeight: 20 },
  pipelineRow:  { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  pipelineStep: {
    backgroundColor: '#222222', borderRadius: 6, paddingHorizontal: 10,
    paddingVertical: 5, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  pipelineStepActive:  { backgroundColor: '#D4AF37' },
  pipelineLabel:       { fontSize: 11, color: '#888888', fontWeight: '700' },
  pipelineLabelActive: { color: '#0A0A0A' },
  pipelineLine:        { width: 16, height: 1, backgroundColor: 'rgba(212,175,55,0.3)' },
  loadingNote:         { color: '#555555', fontSize: 12, textAlign: 'center', lineHeight: 18 },

  warningBanner: {
    backgroundColor: 'rgba(212,175,55,0.05)', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.2)', borderRadius: 8, padding: 10, marginBottom: 8,
  },
  warningText: { fontSize: 12, color: '#888888', lineHeight: 18 },
  warningBold: { color: '#D4AF37', fontWeight: '700' },

  sectionLabel: { fontSize: 15, fontWeight: '700', color: '#F5F5F0', marginTop: 16, marginBottom: 10 },
  goldText:     { color: '#D4AF37' },
  optional:     { fontSize: 12, color: '#888888', fontWeight: '400' },

  imageBtns: { flexDirection: 'row', gap: 12 },
  imageBtn: {
    flex: 1, backgroundColor: '#1A1A1A', borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.2)', borderStyle: 'dashed',
  },
  imageBtnIcon: { fontSize: 34, marginBottom: 8 },
  imageBtnText: { fontSize: 14, color: '#888888', fontWeight: '500' },

  previewImg: {
    width: '100%', height: 220, borderRadius: 14,
    marginBottom: 10, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  imgBtnRow: { flexDirection: 'row', gap: 10 },
  changeBtn: {
    flex: 1, backgroundColor: 'rgba(212,175,55,0.1)', padding: 10,
    borderRadius: 50, alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)',
  },
  changeBtnText:  { color: '#D4AF37', fontWeight: '600', fontSize: 14 },
  removeBtnBorder:{ borderColor: '#444444', backgroundColor: 'transparent' },
  removeBtnText:  { color: '#888888', fontWeight: '600', fontSize: 14 },

  budgetSection: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', marginTop: 4,
  },
  toggleRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  toggleBtn: {
    flex: 1, padding: 9, borderRadius: 8, alignItems: 'center',
    backgroundColor: '#222222', borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  toggleBtnActive:  { backgroundColor: '#D4AF37' },
  toggleText:       { color: '#888888', fontWeight: '600', fontSize: 13 },
  toggleTextActive: { color: '#0A0A0A' },

  quickBudgets: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  quickBtn: {
    paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', backgroundColor: '#222222',
  },
  quickBtnActive:    { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  quickBtnText:      { fontSize: 13, color: '#888888', fontWeight: '500' },
  quickBtnTextActive:{ color: '#0A0A0A', fontWeight: '800' },

  customRow:   { flexDirection: 'row', alignItems: 'center', gap: 8 },
  rsLabel:     { color: '#D4AF37', fontWeight: '800', fontSize: 18 },
  customInput: {
    flex: 1, backgroundColor: '#222222', borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.3)', borderRadius: 8, padding: 12,
    color: '#F5F5F0', fontSize: 16,
  },
  minNote: { fontSize: 12, color: '#555555', marginTop: 6 },

  styleBtns: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  styleBtn: {
    flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16,
    paddingVertical: 10, borderRadius: 50, borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.2)', backgroundColor: '#1A1A1A', gap: 6,
  },
  styleBtnActive:    { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  styleIcon:         { fontSize: 16 },
  styleBtnText:      { fontSize: 14, color: '#888888', fontWeight: '500' },
  styleBtnTextActive:{ color: '#0A0A0A', fontWeight: '800' },

  promptSection: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', marginTop: 4,
  },
  promptInput: {
    backgroundColor: '#222222', borderWidth: 1.5, borderColor: 'rgba(212,175,55,0.2)',
    borderRadius: 10, padding: 12, color: '#F5F5F0', fontSize: 14, minHeight: 90, lineHeight: 20,
  },
  charCount: { textAlign: 'right', fontSize: 11, color: '#555555', marginTop: 6 },

  summaryCard: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', marginTop: 16,
  },
  summaryRow: {
    flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7,
    borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.08)',
  },
  summaryLabel: { fontSize: 13, color: '#888888' },
  summaryValue: { fontSize: 13, color: '#F5F5F0', fontWeight: '700', textTransform: 'capitalize' },

  analyzeBtn:         { backgroundColor: '#D4AF37', borderRadius: 50, padding: 18, alignItems: 'center', marginTop: 20 },
  analyzeBtnDisabled: { backgroundColor: 'rgba(212,175,55,0.3)' },
  analyzeBtnText:     { color: '#0A0A0A', fontSize: 17, fontWeight: '800' },

  footer:     { alignItems: 'center', marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.1)' },
  footerText: { fontSize: 11, color: '#555555', textAlign: 'center', marginBottom: 4 },
  footerGold: { fontSize: 11, color: '#D4AF37', textAlign: 'center', fontWeight: '600' },
});