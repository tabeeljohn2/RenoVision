// screens/ResultsScreen.js
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Image,
  TouchableOpacity, Share, Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function ResultsScreen({ navigation }) {
  const [results,       setResults]       = useState(null);
  const [originalImage, setOriginalImage] = useState(null);
  const [activeTab,     setActiveTab]     = useState('design'); // design first — most impressive

  useEffect(() => { loadResults(); }, []);

  const loadResults = async () => {
    try {
      const saved = await AsyncStorage.getItem('renovisionResults');
      const img   = await AsyncStorage.getItem('renovisionImage');
      if (saved) { setResults(JSON.parse(saved)); setOriginalImage(img); }
    } catch (e) {
      console.error('Load results error:', e);
    }
  };

  const handleShare = async () => {
    try {
      const { cv_analysis, xai_results } = results || {};
      const recs = (xai_results?.recommendations ?? []).filter((r) => !r.is_prompt_based);
      const msg =
        `🏠 RenoVision Analysis\n\n` +
        `Room: ${cv_analysis?.room_type ?? '—'}\n` +
        `Furniture: ${cv_analysis?.furniture_count ?? 0} items\n` +
        `Top tip: ${recs[0]?.recommendation ?? 'Room looks great!'}\n\n` +
        `Built with RenoVision — AI Interior Planner\n` +
        `LGU BSCS 2026 | Ahmad Raza & Tabeel John`;
      await Share.share({ message: msg });
    } catch (e) {
      Alert.alert('Share failed', e.message);
    }
  };

  // ── Loading state ─────────────────────────────────────────────────────
  if (!results) {
    return (
      <View style={styles.loadingScreen}>
        <Text style={styles.loadingIcon}>⏳</Text>
        <Text style={styles.loadingText}>Loading results...</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Upload')} style={styles.backFromLoad}>
          <Text style={styles.backFromLoadText}>← Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  // ── Safe destructuring ────────────────────────────────────────────────
  const { cv_analysis, xai_results, generated_design } = results;
  const recommendations      = xai_results?.recommendations ?? [];
  const normalRecs           = recommendations.filter((r) => !r.is_prompt_based);
  const summary              = xai_results?.summary ?? {};
  const detectedFurniture    = cv_analysis?.detected_furniture ?? [];
  const dominantColors       = cv_analysis?.dominant_colors ?? [];

  const fmt = (val) => (val != null ? Number(val).toLocaleString() : '—');

  const TABS = [
    { key: 'design',          label: `🎨 Design` },
    { key: 'recommendations', label: `💡 Tips (${normalRecs.length})` },
    { key: 'analysis',        label: `👁️ CV` },
  ];

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>

      {/* ── Header ── */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
          <Text style={styles.backText}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Your Results</Text>
        <TouchableOpacity onPress={handleShare} style={styles.shareBtn}>
          <Text style={styles.shareText}>Share</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.content}>

        {/* ── Custom Prompt Badge ── */}
        {results.user_prompt?.trim() ? (
          <View style={styles.promptBox}>
            <Text style={styles.promptLabel}>✍️ YOUR CUSTOM REQUEST</Text>
            <Text style={styles.promptText}>"{results.user_prompt}"</Text>
          </View>
        ) : null}

        {/* ── Info Grid ── */}
        <View style={styles.infoGrid}>
          {[
            { icon: '🏠', label: 'Room Type',  value: cv_analysis?.room_type     ?? '—' },
            { icon: '🛋️', label: 'Items Found', value: String(cv_analysis?.furniture_count ?? 0) },
            { icon: '📊', label: 'Room Status', value: cv_analysis?.room_density  ?? '—' },
            { icon: '💡', label: 'Suggestions', value: String(normalRecs.length) },
          ].map((item, i) => (
            <View key={i} style={styles.infoCard}>
              <Text style={styles.infoIcon}>{item.icon}</Text>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue} numberOfLines={2}>{item.value}</Text>
            </View>
          ))}
        </View>

        {/* ── Summary Box ── */}
        <View style={styles.summaryBox}>
          <Text style={styles.summaryTitle}>📋 AI Summary</Text>
          <Text style={styles.summaryText}>{summary.summary ?? 'No summary available.'}</Text>
          <Text style={styles.summaryStats}>
            Total Est. Cost: Rs. {fmt(summary.total_estimated_cost)}
          </Text>
        </View>

        {/* ── Tabs ── */}
        <View style={styles.tabs}>
          {TABS.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[styles.tab, activeTab === tab.key && styles.tabActive]}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text style={[styles.tabText, activeTab === tab.key && styles.tabTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* ══════════════════ DESIGN TAB ══════════════════ */}
        {activeTab === 'design' && (
          <View>
            {/* Original */}
            <Text style={styles.designLabel}>📷 Original Room</Text>
            {originalImage ? (
              <Image source={{ uri: originalImage }} style={styles.designImage} resizeMode="cover" />
            ) : (
              <View style={styles.designPlaceholder}>
                <Text style={styles.designPlaceholderText}>Original image not available</Text>
              </View>
            )}

            {/* AI Generated */}
            <Text style={[styles.designLabel, { marginTop: 20 }]}>🎨 AI Renovated Design</Text>

            {generated_design?.success && generated_design?.image_base64 ? (
              <>
                <Image
                  source={{ uri: `data:image/png;base64,${generated_design.image_base64}` }}
                  style={styles.designImage}
                  resizeMode="cover"
                />
                <View style={styles.designMeta}>
                  <Text style={styles.designMetaText}>
                    Model: {generated_design.model_used ?? 'SD v1.5 + LoRA'}
                  </Text>
                  {results.user_prompt?.trim() ? (
                    <Text style={styles.designMetaGold}>✍️ Based on your custom request</Text>
                  ) : null}
                </View>
              </>
            ) : (
              <View style={styles.designError}>
                <Text style={styles.designErrorIcon}>⚠️</Text>
                <Text style={styles.designErrorText}>Image generation unavailable</Text>
                <Text style={styles.designErrorSub}>
                  {generated_design?.error
                    ? generated_design.error.length > 120
                      ? generated_design.error.substring(0, 120) + '...'
                      : generated_design.error
                    : 'Kaggle GPU may be offline. Start your notebook and try again.'}
                </Text>
                <TouchableOpacity
                  style={styles.retryBtn}
                  onPress={() => navigation.navigate('Upload')}
                >
                  <Text style={styles.retryBtnText}>Try Again</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* ══════════════════ RECOMMENDATIONS TAB ══════════════════ */}
        {activeTab === 'recommendations' && (
          <View>
            {normalRecs.length === 0 ? (
              <View style={styles.emptyBox}>
                <Text style={styles.emptyIcon}>🎉</Text>
                <Text style={styles.emptyText}>Your room looks great!</Text>
                <Text style={styles.emptySubText}>No major renovations needed within your budget.</Text>
              </View>
            ) : (
              normalRecs.map((rec, index) => (
                <View key={rec.id ?? index} style={styles.recCard}>
                  <View style={styles.recHeader}>
                    <View style={styles.recNum}>
                      <Text style={styles.recNumText}>{index + 1}</Text>
                    </View>
                    <Text style={styles.recTitle} numberOfLines={3}>{rec.recommendation}</Text>
                    <View style={[
                      styles.badge,
                      rec.priority === 'High'   && styles.badgeHigh,
                      rec.priority === 'Medium' && styles.badgeMedium,
                      rec.priority === 'Low'    && styles.badgeLow,
                    ]}>
                      <Text style={[
                        styles.badgeText,
                        rec.priority === 'High'   && { color: '#f87171' },
                        rec.priority === 'Medium' && { color: '#D4AF37' },
                        rec.priority === 'Low'    && { color: '#34d399' },
                      ]}>
                        {rec.priority}
                      </Text>
                    </View>
                  </View>
                  <View style={styles.recReason}>
                    <Text style={styles.recReasonText}>💬 {rec.reason}</Text>
                  </View>
                  <Text style={styles.recCost}>💰 Est. Rs. {fmt(rec.estimated_cost)}</Text>
                </View>
              ))
            )}
          </View>
        )}

        {/* ══════════════════ CV ANALYSIS TAB ══════════════════ */}
        {activeTab === 'analysis' && (
          <View>
            {/* Detected Furniture */}
            <Text style={styles.cvTitle}>🛋️ Detected Furniture</Text>
            {detectedFurniture.length === 0 ? (
              <Text style={styles.cvEmpty}>No furniture detected</Text>
            ) : (
              detectedFurniture.map((item, i) => (
                <View key={i} style={styles.furnitureRow}>
                  <Text style={styles.furnitureName}>{item.item}</Text>
                  <View style={styles.confBar}>
                    <View style={[styles.confFill, { width: `${Math.min(item.confidence ?? 0, 100)}%` }]} />
                  </View>
                  <Text style={styles.confValue}>{item.confidence ?? 0}%</Text>
                </View>
              ))
            )}

            {/* Dominant Colors */}
            <Text style={[styles.cvTitle, { marginTop: 16 }]}>🎨 Dominant Colors</Text>
            {dominantColors.length === 0 ? (
              <Text style={styles.cvEmpty}>No color data</Text>
            ) : (
              <View style={styles.colorsRow}>
                {dominantColors.map((color, i) => (
                  <View key={i} style={styles.colorItem}>
                    <View style={[styles.colorSwatch, { backgroundColor: color }]} />
                    <Text style={styles.colorHex}>{color}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Room Dimensions */}
            {cv_analysis?.dimensions ? (
              <View style={styles.dimensionsBox}>
                <Text style={[styles.cvTitle, { marginTop: 0, marginBottom: 8 }]}>📐 Room Analysis</Text>
                {[
                  { label: 'Room Size',        value: cv_analysis.dimensions.estimated_size         ?? '—' },
                  { label: 'Layout',           value: cv_analysis.dimensions.room_width_type        ?? '—' },
                  { label: 'Structural Lines', value: String(cv_analysis.dimensions.structural_lines_detected ?? '—') },
                ].map((item, i) => (
                  <View key={i} style={styles.dimensionRow}>
                    <Text style={styles.dimensionLabel}>{item.label}</Text>
                    <Text style={styles.dimensionValue}>{item.value}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        )}

        {/* ── Disclaimer ── */}
        <View style={styles.disclaimer}>
          <Text style={styles.disclaimerText}>
            ⚠️ All recommendations are advisory only. Consult qualified professionals
            before making actual renovation decisions.
          </Text>
        </View>

        {/* ── Analyze Another ── */}
        <TouchableOpacity style={styles.againBtn} onPress={() => navigation.navigate('Upload')}>
          <Text style={styles.againBtnText}>📸 Analyze Another Room</Text>
        </TouchableOpacity>

        {/* ── Footer ── */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>RenoVision — Final Year Project</Text>
          <Text style={styles.footerText}>Lahore Garrison University | BSCS 2026</Text>
          <Text style={[styles.footerText, { color: '#D4AF37' }]}>Built by Ahmad Raza & Tabeel John</Text>
        </View>

      </View>
      <View style={{ height: 30 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0A0A0A' },

  loadingScreen: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0A0A0A' },
  loadingIcon:   { fontSize: 40, marginBottom: 12 },
  loadingText:   { color: '#888888', fontSize: 16, marginBottom: 20 },
  backFromLoad:  { backgroundColor: 'rgba(212,175,55,0.1)', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 50, borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)' },
  backFromLoadText: { color: '#D4AF37', fontWeight: '700' },

  header: {
    backgroundColor: '#111111', padding: 16, paddingTop: 50,
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.15)',
  },
  backBtn:     { width: 60 },
  backText:    { color: '#D4AF37', fontSize: 16, fontWeight: '600' },
  headerTitle: { color: '#F5F5F0', fontSize: 17, fontWeight: '700' },
  shareBtn:    { backgroundColor: 'rgba(212,175,55,0.1)', borderWidth: 1, borderColor: 'rgba(212,175,55,0.3)', paddingVertical: 6, paddingHorizontal: 12, borderRadius: 50 },
  shareText:   { color: '#D4AF37', fontSize: 13, fontWeight: '600' },

  content: { padding: 16 },

  promptBox: {
    backgroundColor: 'rgba(212,175,55,0.05)', borderWidth: 1,
    borderColor: 'rgba(212,175,55,0.3)', borderRadius: 12, padding: 14,
    marginBottom: 16, borderLeftWidth: 3, borderLeftColor: '#D4AF37',
  },
  promptLabel: { fontSize: 11, color: '#D4AF37', fontWeight: '700', letterSpacing: 1, marginBottom: 6 },
  promptText:  { fontSize: 14, color: '#F5F5F0', fontStyle: 'italic', lineHeight: 20 },

  infoGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 16 },
  infoCard: {
    backgroundColor: '#1A1A1A', borderRadius: 12, padding: 12,
    alignItems: 'center', width: '47%', borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)',
  },
  infoIcon:  { fontSize: 22, marginBottom: 4 },
  infoLabel: { fontSize: 11, color: '#888888', marginBottom: 4, textTransform: 'uppercase', letterSpacing: 0.5 },
  infoValue: { fontSize: 13, fontWeight: '700', color: '#F5F5F0', textAlign: 'center', textTransform: 'capitalize' },

  summaryBox: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14, marginBottom: 16,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)', borderLeftWidth: 3, borderLeftColor: '#D4AF37',
  },
  summaryTitle: { fontSize: 15, fontWeight: '700', color: '#F5F5F0', marginBottom: 8 },
  summaryText:  { fontSize: 13, color: '#888888', lineHeight: 20, marginBottom: 8 },
  summaryStats: { fontSize: 13, color: '#D4AF37', fontWeight: '700' },

  tabs: { flexDirection: 'row', gap: 6, marginBottom: 16 },
  tab: {
    flex: 1, padding: 10, borderRadius: 50, borderWidth: 1.5,
    borderColor: 'rgba(212,175,55,0.2)', backgroundColor: '#1A1A1A', alignItems: 'center',
  },
  tabActive:     { backgroundColor: '#D4AF37', borderColor: '#D4AF37' },
  tabText:       { fontSize: 11, color: '#888888', fontWeight: '600' },
  tabTextActive: { color: '#0A0A0A', fontWeight: '800' },

  // Design tab
  designLabel: { fontSize: 15, fontWeight: '700', color: '#F5F5F0', marginBottom: 10 },
  designImage: {
    width: '100%', height: 240, borderRadius: 14,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  designMeta:     { flexDirection: 'row', justifyContent: 'space-between', marginTop: 8 },
  designMetaText: { fontSize: 11, color: '#555555' },
  designMetaGold: { fontSize: 11, color: '#D4AF37', fontStyle: 'italic' },
  designPlaceholder: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 30,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)',
  },
  designPlaceholderText: { color: '#555555', fontSize: 14 },
  designError: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 24,
    alignItems: 'center', borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)',
  },
  designErrorIcon: { fontSize: 32, marginBottom: 8 },
  designErrorText: { fontSize: 15, color: '#888888', fontWeight: '700', marginBottom: 8 },
  designErrorSub:  { fontSize: 12, color: '#555555', textAlign: 'center', lineHeight: 18, marginBottom: 14 },
  retryBtn:        { backgroundColor: '#D4AF37', paddingHorizontal: 24, paddingVertical: 10, borderRadius: 50 },
  retryBtnText:    { color: '#0A0A0A', fontWeight: '800', fontSize: 14 },

  // Recommendations tab
  recCard: {
    backgroundColor: '#1A1A1A', borderRadius: 14, padding: 14, marginBottom: 10,
    borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)', borderLeftWidth: 3, borderLeftColor: '#D4AF37',
  },
  recHeader:   { flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 8, flexWrap: 'wrap' },
  recNum:      { width: 26, height: 26, borderRadius: 13, backgroundColor: '#D4AF37', justifyContent: 'center', alignItems: 'center', flexShrink: 0 },
  recNumText:  { color: '#0A0A0A', fontSize: 12, fontWeight: '800' },
  recTitle:    { flex: 1, fontSize: 14, fontWeight: '700', color: '#F5F5F0' },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  badgeHigh:   { backgroundColor: 'rgba(239,68,68,0.15)' },
  badgeMedium: { backgroundColor: 'rgba(212,175,55,0.15)' },
  badgeLow:    { backgroundColor: 'rgba(16,185,129,0.15)' },
  badgeText:   { fontSize: 11, fontWeight: '700' },
  recReason:   { backgroundColor: '#222222', borderRadius: 8, padding: 10, marginBottom: 8, borderLeftWidth: 2, borderLeftColor: 'rgba(212,175,55,0.3)' },
  recReasonText:{ fontSize: 13, color: '#888888', lineHeight: 18 },
  recCost:     { fontSize: 13, color: '#D4AF37', fontWeight: '700' },

  emptyBox:     { alignItems: 'center', padding: 30, backgroundColor: '#1A1A1A', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)' },
  emptyIcon:    { fontSize: 40, marginBottom: 10 },
  emptyText:    { fontSize: 18, color: '#F5F5F0', fontWeight: '700' },
  emptySubText: { fontSize: 13, color: '#888888', marginTop: 6, textAlign: 'center' },

  // CV tab
  cvTitle: { fontSize: 15, fontWeight: '700', color: '#F5F5F0', marginBottom: 10, marginTop: 4 },
  cvEmpty: { color: '#555555', fontSize: 13 },
  furnitureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 },
  furnitureName:{ width: 110, fontSize: 13, color: '#F5F5F0', textTransform: 'capitalize' },
  confBar:      { flex: 1, height: 6, backgroundColor: '#222222', borderRadius: 3, overflow: 'hidden' },
  confFill:     { height: '100%', backgroundColor: '#D4AF37', borderRadius: 3 },
  confValue:    { width: 42, fontSize: 12, color: '#D4AF37', textAlign: 'right', fontWeight: '700' },

  colorsRow:   { flexDirection: 'row', gap: 14, flexWrap: 'wrap' },
  colorItem:   { alignItems: 'center' },
  colorSwatch: { width: 56, height: 56, borderRadius: 10, marginBottom: 5, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)' },
  colorHex:    { fontSize: 10, color: '#888888', fontFamily: 'monospace' },

  dimensionsBox:  { marginTop: 16, backgroundColor: '#1A1A1A', borderRadius: 12, padding: 14, borderWidth: 1, borderColor: 'rgba(212,175,55,0.15)' },
  dimensionRow:   { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(212,175,55,0.06)' },
  dimensionLabel: { color: '#888888', fontSize: 13 },
  dimensionValue: { color: '#D4AF37', fontSize: 13, fontWeight: '700', textTransform: 'capitalize' },

  disclaimer: {
    backgroundColor: 'rgba(212,175,55,0.05)', borderRadius: 12, padding: 12,
    marginTop: 16, borderWidth: 1, borderColor: 'rgba(212,175,55,0.2)',
  },
  disclaimerText: { fontSize: 12, color: '#888888', lineHeight: 18 },

  againBtn:     { backgroundColor: '#D4AF37', borderRadius: 50, padding: 16, alignItems: 'center', marginTop: 16 },
  againBtnText: { color: '#0A0A0A', fontSize: 16, fontWeight: '800' },

  footer:     { alignItems: 'center', marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: 'rgba(212,175,55,0.1)' },
  footerText: { fontSize: 12, color: '#555555', textAlign: 'center', marginBottom: 4 },
});