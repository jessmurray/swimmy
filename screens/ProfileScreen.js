import React, { useState } from 'react';
import {
  StyleSheet, Text, View, TouchableOpacity, SafeAreaView, ScrollView,
  Alert, ActivityIndicator, TextInput, Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { regeneratePlan } from '../services/regeneratePlan';

const { width } = Dimensions.get('window');

const C = {
  bg:           '#F5F0E8',
  navy:         '#042C53',
  navyAlpha60:  'rgba(4,44,83,0.6)',
  navyAlpha30:  'rgba(4,44,83,0.3)',
  navyAlpha15:  'rgba(4,44,83,0.15)',
  navyAlpha08:  'rgba(4,44,83,0.08)',
  navyAlpha06:  'rgba(4,44,83,0.06)',
  accent:       '#00A8E8',
  accentBg:     'rgba(0,168,232,0.10)',
  accentBorder: 'rgba(0,168,232,0.40)',
  white:        '#FFFFFF',
  red:          '#ef4444',
  redBg:        'rgba(239,68,68,0.08)',
  redBorder:    'rgba(239,68,68,0.15)',
  disabled:     'rgba(4,44,83,0.25)',
};

const TRAINING_DAY_OPTIONS = [
  { label: '1–2 days', sub: 'Light commitment' },
  { label: '3–4 days', sub: 'Steady progress' },
  { label: '5–7 days', sub: 'High commitment' },
];
const SESSION_LENGTH_OPTIONS = [
  { label: '15 minutes' },
  { label: '30 minutes' },
  { label: '45 minutes' },
  { label: '60 minutes' },
  { label: '90 minutes' },
  { label: '120+ minutes' },
];
const POOL_OPTIONS = [
  { label: '25m pool',  sub: 'Short course' },
  { label: '50m pool',  sub: 'Long course / Olympic' },
  { label: 'Both',      sub: 'I use either' },
];
const EQUIPMENT_OPTIONS = ['Kickboard', 'Pull buoy', 'Paddles', 'Fins', 'Snorkel', 'None'];
const SWIM_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function initPrefs(meta) {
  return {
    training_days:  meta?.training_days  ?? 1,
    swim_days:      meta?.swim_days      ?? [],
    session_length: meta?.session_length ?? 3,
    pool_length:    meta?.pool_length    ?? 0,
    equipment:      meta?.equipment      ?? [],
  };
}

export default function ProfileScreen({ profile, user, plan, onSignOut, onBack, onPlanUpdate }) {
  const name     = profile?.name ?? '';
  const email    = user?.email   ?? '';
  const initials = name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) || '?';

  const meta = plan?._meta ?? {};

  const [prefs, setPrefs]           = useState(() => initPrefs(meta));
  const [origPrefs]                 = useState(() => initPrefs(meta));
  const [saving, setSaving]         = useState(false);
  const [saveMsg, setSaveMsg]       = useState('');
  const [changingPwd, setChangingPwd] = useState(false);
  const [newPwd, setNewPwd]         = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [pwdMsg, setPwdMsg]         = useState('');
  const [pwdSaving, setPwdSaving]   = useState(false);

  const dirty = JSON.stringify(prefs) !== JSON.stringify(origPrefs);

  // ── Pref toggles ─────────────────────────────────────────────────────────────

  const toggleSwimDay = (day) => setPrefs(p => ({
    ...p,
    swim_days: p.swim_days.includes(day)
      ? p.swim_days.filter(d => d !== day)
      : [...p.swim_days, day],
  }));

  const toggleEquipment = (item) => {
    if (item === 'None') {
      setPrefs(p => ({ ...p, equipment: p.equipment.includes('None') ? [] : ['None'] }));
      return;
    }
    setPrefs(p => ({
      ...p,
      equipment: p.equipment.includes(item)
        ? p.equipment.filter(x => x !== item)
        : [...p.equipment.filter(x => x !== 'None'), item],
    }));
  };

  // ── Save & regenerate ─────────────────────────────────────────────────────────

  const handleSave = async () => {
    if (!plan || !onPlanUpdate) return;
    setSaving(true);
    setSaveMsg('');
    try {
      const { data: sessions } = await supabase
        .from('completed_sessions')
        .select('week_number')
        .eq('user_id', user.id)
        .order('week_number', { ascending: false })
        .limit(1);

      const maxCompletedWeek = sessions?.[0]?.week_number ?? 0;
      const updatedMeta      = { ...meta, ...prefs };
      const keptWeeks        = (plan.weeks || []).slice(0, maxCompletedWeek);
      const newWeeks         = await regeneratePlan(updatedMeta, maxCompletedWeek);

      await onPlanUpdate({
        ...plan,
        _meta:  updatedMeta,
        weeks: [...keptWeeks, ...newWeeks],
      });
      setSaveMsg('Plan updated successfully.');
    } catch (e) {
      console.error('[Profile] Save error:', e?.message ?? e);
      setSaveMsg('Something went wrong. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  // ── Change password ───────────────────────────────────────────────────────────

  const handleChangePassword = async () => {
    if (!newPwd) {
      setPwdMsg('Please enter a new password.');
      return;
    }
    if (newPwd !== confirmPwd) {
      setPwdMsg('Passwords do not match.');
      return;
    }
    if (newPwd.length < 6) {
      setPwdMsg('Password must be at least 6 characters.');
      return;
    }
    setPwdSaving(true);
    setPwdMsg('');
    const { error } = await supabase.auth.updateUser({ password: newPwd });
    setPwdSaving(false);
    if (error) {
      setPwdMsg(error.message);
    } else {
      setPwdMsg('Password updated successfully.');
      setNewPwd('');
      setConfirmPwd('');
      setTimeout(() => { setChangingPwd(false); setPwdMsg(''); }, 1500);
    }
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'Delete Account',
      'Are you sure you want to delete your account? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: () => {} },
      ],
    );
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      <View style={styles.navbar}>
        <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.navy} />
        </TouchableOpacity>
        <Text style={styles.navTitle}>Profile</Text>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* ── Avatar header ─────────────────────────────────────────────────── */}
        <View style={styles.avatarSection}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <Text style={styles.name}>{name}</Text>
          <Text style={styles.email}>{email}</Text>
        </View>

        {/* ── Training Preferences ──────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionPip} />
            <Text style={styles.sectionLabel}>Training Preferences</Text>
          </View>

          {/* Training days per week */}
          <View style={styles.prefGroup}>
            <Text style={styles.prefLabel}>Days per week</Text>
            <View style={styles.optionList}>
              {TRAINING_DAY_OPTIONS.map((opt, idx) => {
                const active = prefs.training_days === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.72}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => setPrefs(p => ({ ...p, training_days: idx }))}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.optionSub, active && { color: C.accent }]}>
                        {opt.sub}
                      </Text>
                    </View>
                    <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                      {active && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Which days */}
          <View style={styles.prefGroup}>
            <Text style={styles.prefLabel}>Swim days</Text>
            <View style={styles.dayChipRow}>
              {SWIM_DAYS.map(day => {
                const active = prefs.swim_days.includes(day);
                return (
                  <TouchableOpacity
                    key={day}
                    activeOpacity={0.72}
                    style={[styles.dayChip, active && styles.dayChipActive]}
                    onPress={() => toggleSwimDay(day)}
                  >
                    <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Session length */}
          <View style={styles.prefGroup}>
            <Text style={styles.prefLabel}>Session length</Text>
            <View style={styles.optionList}>
              {SESSION_LENGTH_OPTIONS.map((opt, idx) => {
                const active = prefs.session_length === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.72}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => setPrefs(p => ({ ...p, session_length: idx }))}
                  >
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive, { flex: 1 }]}>
                      {opt.label}
                    </Text>
                    <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                      {active && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Pool length */}
          <View style={styles.prefGroup}>
            <Text style={styles.prefLabel}>Pool length</Text>
            <View style={styles.optionList}>
              {POOL_OPTIONS.map((opt, idx) => {
                const active = prefs.pool_length === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    activeOpacity={0.72}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => setPrefs(p => ({ ...p, pool_length: idx }))}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                        {opt.label}
                      </Text>
                      <Text style={[styles.optionSub, active && { color: C.accent }]}>
                        {opt.sub}
                      </Text>
                    </View>
                    <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
                      {active && <View style={styles.radioInner} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Equipment */}
          <View style={styles.prefGroup}>
            <Text style={styles.prefLabel}>Equipment</Text>
            <View style={styles.optionList}>
              {EQUIPMENT_OPTIONS.map(opt => {
                const active = prefs.equipment.includes(opt);
                return (
                  <TouchableOpacity
                    key={opt}
                    activeOpacity={0.72}
                    style={[styles.optionRow, active && styles.optionRowActive]}
                    onPress={() => toggleEquipment(opt)}
                  >
                    <View style={[styles.checkbox, active && styles.checkboxActive]}>
                      {active && <Ionicons name="checkmark" size={12} color={C.white} />}
                    </View>
                    <Text style={[styles.optionLabel, active && styles.optionLabelActive, { flex: 1, marginLeft: 12 }]}>
                      {opt}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Save button / loading state */}
          {saving ? (
            <View style={styles.savingContainer}>
              <ActivityIndicator color={C.accent} size="small" />
              <Text style={styles.savingText}>Regenerating your plan…</Text>
            </View>
          ) : (
            <TouchableOpacity
              style={[styles.saveBtn, !dirty && styles.saveBtnDisabled]}
              onPress={dirty ? handleSave : undefined}
              activeOpacity={dirty ? 0.85 : 1}
            >
              <Ionicons
                name="checkmark"
                size={18}
                color={dirty ? C.white : C.disabled}
              />
              <Text style={[styles.saveBtnText, !dirty && styles.saveBtnTextDisabled]}>
                Save & Regenerate Plan
              </Text>
            </TouchableOpacity>
          )}

          {saveMsg ? (
            <Text style={[styles.feedbackMsg, saveMsg.includes('wrong') && { color: C.red }]}>
              {saveMsg}
            </Text>
          ) : null}
        </View>

        {/* ── Section divider ───────────────────────────────────────────────── */}
        <View style={styles.sectionDivider} />

        {/* ── Account Settings ──────────────────────────────────────────────── */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionPip} />
            <Text style={styles.sectionLabel}>Account Settings</Text>
          </View>

          <View style={styles.card}>
            {/* Change password */}
            <TouchableOpacity
              style={styles.settingsRow}
              activeOpacity={0.7}
              onPress={() => {
                setChangingPwd(v => !v);
                setPwdMsg('');
                setNewPwd('');
                setConfirmPwd('');
              }}
            >
              <View style={styles.rowIcon}>
                <Ionicons name="lock-closed-outline" size={18} color={C.accent} />
              </View>
              <Text style={styles.settingsRowLabel}>Change Password</Text>
              <Ionicons
                name={changingPwd ? 'chevron-up' : 'chevron-down'}
                size={16}
                color={C.navyAlpha30}
              />
            </TouchableOpacity>

            {changingPwd && (
              <View style={styles.pwdForm}>
                <TextInput
                  style={styles.pwdInput}
                  value={newPwd}
                  onChangeText={setNewPwd}
                  placeholder="New password"
                  placeholderTextColor={C.navyAlpha30}
                  secureTextEntry
                  autoCapitalize="none"
                />
                <TextInput
                  style={[styles.pwdInput, { marginTop: 8 }]}
                  value={confirmPwd}
                  onChangeText={setConfirmPwd}
                  placeholder="Confirm new password"
                  placeholderTextColor={C.navyAlpha30}
                  secureTextEntry
                  autoCapitalize="none"
                />
                {pwdMsg ? (
                  <Text style={[
                    styles.feedbackMsg,
                    { marginTop: 8 },
                    pwdMsg.includes('success') && { color: C.accent },
                  ]}>
                    {pwdMsg}
                  </Text>
                ) : null}
                <TouchableOpacity
                  style={styles.pwdSubmitBtn}
                  onPress={handleChangePassword}
                  activeOpacity={0.85}
                  disabled={pwdSaving}
                >
                  {pwdSaving
                    ? <ActivityIndicator color={C.white} size="small" />
                    : <Text style={styles.pwdSubmitBtnText}>Update Password</Text>
                  }
                </TouchableOpacity>
              </View>
            )}

            <View style={styles.rowDivider} />

            {/* Delete account */}
            <TouchableOpacity
              style={styles.settingsRow}
              activeOpacity={0.7}
              onPress={handleDeleteAccount}
            >
              <View style={[styles.rowIcon, { backgroundColor: C.redBg }]}>
                <Ionicons name="trash-outline" size={18} color={C.red} />
              </View>
              <Text style={[styles.settingsRowLabel, { color: C.red }]}>Delete Account</Text>
              <Ionicons name="chevron-forward" size={16} color="rgba(239,68,68,0.4)" />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Sign out ──────────────────────────────────────────────────────── */}
        <View style={[styles.section, { marginBottom: 8 }]}>
          <TouchableOpacity style={styles.signOutBtn} onPress={onSignOut} activeOpacity={0.85}>
            <Ionicons name="log-out-outline" size={20} color={C.red} />
            <Text style={styles.signOutText}>Sign out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe:    { flex: 1, backgroundColor: C.bg },
  scroll:  { flex: 1 },
  content: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 48 },

  // Navbar
  navbar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 12, paddingVertical: 10,
  },
  backBtn:  { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  navTitle: { fontSize: 17, fontWeight: '700', color: C.navy, letterSpacing: -0.2 },

  // Avatar header
  avatarSection: { alignItems: 'center', paddingVertical: 28 },
  avatar: {
    width: 80, height: 80, borderRadius: 40,
    backgroundColor: C.navy, alignItems: 'center', justifyContent: 'center',
    marginBottom: 14,
  },
  avatarText: { fontSize: 28, fontWeight: '800', color: C.white },
  name:       { fontSize: 22, fontWeight: '800', color: C.navy, letterSpacing: -0.3, marginBottom: 4 },
  email:      { fontSize: 14, color: C.navyAlpha60 },

  // Sections
  section: { marginBottom: 28 },
  sectionDivider: { height: 1, backgroundColor: C.navyAlpha08, marginBottom: 28, marginHorizontal: 4 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 16, paddingHorizontal: 4 },
  sectionPip:    { width: 3, height: 14, borderRadius: 2, backgroundColor: C.accent, marginRight: 8 },
  sectionLabel: {
    fontSize: 11, fontWeight: '700', color: C.navyAlpha30,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },

  // Preference groups
  prefGroup: { marginBottom: 20 },
  prefLabel: {
    fontSize: 13, fontWeight: '700', color: C.navy,
    letterSpacing: 0.1, marginBottom: 10,
  },

  // Option rows (shared by single + multi select)
  optionList: { gap: 8 },
  optionRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: C.white, borderWidth: 1.5,
    borderColor: C.navyAlpha15, borderRadius: 14,
    paddingHorizontal: 16, paddingVertical: 13,
  },
  optionRowActive: { borderColor: C.accent, backgroundColor: C.accentBg },
  optionLabel:       { fontSize: 15, fontWeight: '600', color: C.navy, lineHeight: 20 },
  optionLabelActive: { color: C.navy },
  optionSub:         { fontSize: 12, color: C.navyAlpha60, marginTop: 2 },

  // Radio button
  radioOuter: {
    width: 20, height: 20, borderRadius: 10, borderWidth: 2,
    borderColor: C.navyAlpha30, alignItems: 'center', justifyContent: 'center',
    marginLeft: 8, flexShrink: 0,
  },
  radioOuterActive: { borderColor: C.accent },
  radioInner:       { width: 10, height: 10, borderRadius: 5, backgroundColor: C.accent },

  // Checkbox
  checkbox: {
    width: 22, height: 22, borderRadius: 6, borderWidth: 2,
    borderColor: C.navyAlpha30, alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  checkboxActive: { backgroundColor: C.accent, borderColor: C.accent },

  // Day chips
  dayChipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: {
    paddingHorizontal: 14, paddingVertical: 12, borderRadius: 12,
    backgroundColor: C.white, borderWidth: 1.5, borderColor: C.navyAlpha15,
    minWidth: (width - 40 - 48) / 7, alignItems: 'center',
  },
  dayChipActive:     { backgroundColor: C.accent, borderColor: C.accent },
  dayChipText:       { fontSize: 13, fontWeight: '700', color: C.navy },
  dayChipTextActive: { color: C.white },

  // Save button
  savingContainer: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 18,
  },
  savingText: { fontSize: 15, fontWeight: '600', color: C.navyAlpha60 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, backgroundColor: C.navy, borderRadius: 14, paddingVertical: 16,
    marginTop: 8,
  },
  saveBtnDisabled: { backgroundColor: C.navyAlpha15 },
  saveBtnText:        { fontSize: 16, fontWeight: '700', color: C.white, letterSpacing: 0.2 },
  saveBtnTextDisabled: { color: C.disabled },
  feedbackMsg: {
    fontSize: 13, color: C.accent, fontWeight: '600',
    textAlign: 'center', marginTop: 10,
  },

  // Account settings card
  card: {
    backgroundColor: C.white, borderRadius: 16,
    borderWidth: 1, borderColor: C.navyAlpha08, overflow: 'hidden',
  },
  settingsRow: {
    flexDirection: 'row', alignItems: 'center', padding: 16,
  },
  rowIcon: {
    width: 36, height: 36, borderRadius: 10,
    backgroundColor: 'rgba(0,168,232,0.10)',
    alignItems: 'center', justifyContent: 'center', marginRight: 14,
  },
  settingsRowLabel: { flex: 1, fontSize: 15, fontWeight: '600', color: C.navy },
  rowDivider: { height: 1, backgroundColor: C.navyAlpha08, marginLeft: 66 },

  // Password form
  pwdForm: { paddingHorizontal: 16, paddingBottom: 16 },
  pwdInput: {
    backgroundColor: C.bg, borderWidth: 1.5, borderColor: C.navyAlpha15,
    borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12,
    fontSize: 15, fontWeight: '500', color: C.navy,
  },
  pwdSubmitBtn: {
    backgroundColor: C.accent, borderRadius: 12,
    paddingVertical: 13, alignItems: 'center', justifyContent: 'center',
    marginTop: 12,
  },
  pwdSubmitBtnText: { fontSize: 15, fontWeight: '700', color: C.white },

  // Sign out
  signOutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 10, paddingVertical: 16, borderRadius: 16,
    backgroundColor: C.redBg, borderWidth: 1, borderColor: C.redBorder,
  },
  signOutText: { fontSize: 16, fontWeight: '700', color: C.red },
});
