import React, { useState, useRef } from 'react';
import {
  StyleSheet, Text, View, TextInput, TouchableOpacity,
  SafeAreaView, ScrollView, KeyboardAvoidingView, Platform, Dimensions,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';

const { width } = Dimensions.get('window');

const C = {
  bg: '#F5F0E8',
  navy: '#042C53',
  navyAlpha60: 'rgba(4,44,83,0.6)',
  navyAlpha30: 'rgba(4,44,83,0.3)',
  navyAlpha15: 'rgba(4,44,83,0.15)',
  navyAlpha08: 'rgba(4,44,83,0.08)',
  accent: '#00A8E8',
  accentBg: 'rgba(0,168,232,0.10)',
  accentBorder: 'rgba(0,168,232,0.40)',
  white: '#FFFFFF',
  disabled: 'rgba(4,44,83,0.25)',
};

// ── Data ──────────────────────────────────────────────────────────────────────

const STEPS = [
  {
    id: 'name',
    type: 'text_input',
    question: "What's your name?",
    sub: "We'll personalise your plan.",
    placeholder: 'First name',
    autoCapitalize: 'words',
  },
  {
    id: 'dob',
    type: 'dob',
    question: 'When were you born?',
    sub: 'Used to calibrate training load and recovery.',
  },
  {
    id: 'goal',
    type: 'single_select',
    question: "What's your main goal?",
    sub: 'Choose the one that fits best.',
    options: [
      { label: 'Improve general fitness',                      icon: 'heart-outline' },
      { label: 'Cross-train or complement another sport',      icon: 'barbell-outline' },
      { label: 'Get back into swimming after a break',         icon: 'refresh-outline' },
      { label: 'Get faster at a stroke or distance',           icon: 'speedometer-outline' },
      { label: 'Train for an event, gala or competition',      icon: 'trophy-outline' },
      { label: 'Train for a triathlon',                        icon: 'bicycle-outline' },
    ],
  },
  {
    id: 'event_date',
    type: 'event_date',
    question: 'When is your event?',
    sub: 'Your plan will peak around this date.',
    conditional: (a) => a.goal === 4,
  },
  {
    id: 'training_days',
    type: 'single_select',
    question: 'How many days a week will you train?',
    sub: 'Be realistic — consistency beats volume.',
    options: [
      { label: '1–2 days', sub: 'Light commitment' },
      { label: '3–4 days', sub: 'Steady progress' },
      { label: '5–7 days', sub: 'High commitment' },
    ],
  },
  {
    id: 'swim_days',
    type: 'multi_select',
    question: 'Which days will you swim?',
    sub: 'Select all that apply.',
    options: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    compact: true,
  },
  {
    id: 'session_length',
    type: 'single_select',
    question: 'How long is each session?',
    sub: 'Include warm-up and cool-down time.',
    options: [
      { label: '15 minutes' },
      { label: '30 minutes' },
      { label: '45 minutes' },
      { label: '60 minutes' },
      { label: '90 minutes' },
      { label: '120+ minutes' },
    ],
  },
  {
    id: 'pool_length',
    type: 'single_select',
    question: 'What pool do you swim in?',
    sub: 'Affects how your sets are calculated.',
    options: [
      { label: '25m pool',  sub: 'Short course' },
      { label: '50m pool',  sub: 'Long course / Olympic' },
      { label: 'Both',      sub: 'I use either' },
    ],
  },
  {
    id: 'equipment',
    type: 'multi_select',
    question: 'What equipment do you have?',
    sub: "We'll build it into your sessions.",
    options: ['Kickboard', 'Pull buoy', 'Paddles', 'Fins', 'Snorkel', 'None'],
  },
  {
    id: 'continuous_distance',
    type: 'single_select',
    question: 'How far can you swim continuously?',
    sub: 'Without stopping or resting on the wall.',
    options: [
      { label: '25m' },
      { label: '50m' },
      { label: '100m' },
      { label: '200m' },
      { label: '400m' },
      { label: '800m+' },
    ],
  },
  {
    id: 'level',
    type: 'single_select',
    question: "What's your current level?",
    sub: 'Honest answers make better plans.',
    options: [
      { label: 'Casual',            sub: 'I swim occasionally for fun' },
      { label: 'Fitness',           sub: 'I swim regularly for exercise' },
      { label: 'Club',              sub: 'I train with a club or squad' },
      { label: 'Competitive',       sub: 'I race at meets or events' },
      { label: 'Former competitive',sub: 'Previously raced, returning to form' },
    ],
  },
  {
    id: 'strokes',
    type: 'strokes_distances',
    question: 'Which strokes and distances do you swim?',
    sub: 'Select every distance you want to train.',
  },
  {
    id: 'has_times',
    type: 'single_select',
    question: 'Do you have any recent race times?',
    sub: 'Used to calibrate your training paces precisely.',
    options: [
      { label: 'Yes — I have some times',  icon: 'checkmark-circle-outline' },
      { label: 'No — estimate for me',     icon: 'help-circle-outline' },
    ],
  },
  {
    id: 'event_times',
    type: 'event_times',
    question: 'Enter your recent times',
    sub: "Leave blank for any you don't have. Format: 1:23.45",
    conditional: (a) => a.has_times === 0,
  },
];

const STROKES = [
  { id: 'freestyle',    label: 'Freestyle',    distances: ['50m','100m','200m','400m','800m','1500m'] },
  { id: 'backstroke',   label: 'Backstroke',   distances: ['50m','100m','200m'] },
  { id: 'breaststroke', label: 'Breaststroke', distances: ['50m','100m','200m'] },
  { id: 'butterfly',    label: 'Butterfly',    distances: ['50m','100m','200m'] },
];

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVisibleSteps(answers) {
  return STEPS.filter((s) => !s.conditional || s.conditional(answers));
}

function canAdvance(step, answers) {
  const val = answers[step.id];
  switch (step.type) {
    case 'text_input':
      return typeof val === 'string' && val.trim().length > 0;
    case 'dob':
      return val?.day?.length >= 1 && val?.month?.length >= 1 && val?.year?.length === 4;
    case 'event_date':
      return val?.month?.length >= 1 && val?.year?.length === 4;
    case 'single_select':
      return typeof val === 'number';
    case 'multi_select':
      return Array.isArray(val) && val.length > 0;
    case 'strokes_distances':
      return val && Object.values(val).some((arr) => arr.length > 0);
    case 'event_times':
      return true;
    default:
      return false;
  }
}

// ── Sub-components ────────────────────────────────────────────────────────────

function TextInputStep({ step, answers, setAnswers }) {
  return (
    <TextInput
      style={styles.textInput}
      value={answers[step.id] || ''}
      onChangeText={(t) => setAnswers((p) => ({ ...p, [step.id]: t }))}
      placeholder={step.placeholder}
      placeholderTextColor={C.navyAlpha30}
      autoCapitalize={step.autoCapitalize || 'none'}
      autoFocus
      returnKeyType="done"
    />
  );
}

function DOBStep({ answers, setAnswers }) {
  const monthRef = useRef();
  const yearRef = useRef();
  const val = answers.dob || {};

  const update = (field, text) =>
    setAnswers((p) => ({ ...p, dob: { ...p.dob, [field]: text } }));

  return (
    <View style={styles.segmentRow}>
      <View style={styles.segmentField}>
        <Text style={styles.segmentFieldLabel}>Day</Text>
        <TextInput
          style={styles.segmentInput}
          value={val.day || ''}
          onChangeText={(t) => { update('day', t); if (t.length === 2) monthRef.current?.focus(); }}
          placeholder="DD"
          placeholderTextColor={C.navyAlpha30}
          keyboardType="number-pad"
          maxLength={2}
          autoFocus
        />
      </View>
      <View style={styles.segmentField}>
        <Text style={styles.segmentFieldLabel}>Month</Text>
        <TextInput
          ref={monthRef}
          style={styles.segmentInput}
          value={val.month || ''}
          onChangeText={(t) => { update('month', t); if (t.length === 2) yearRef.current?.focus(); }}
          placeholder="MM"
          placeholderTextColor={C.navyAlpha30}
          keyboardType="number-pad"
          maxLength={2}
        />
      </View>
      <View style={[styles.segmentField, { flex: 1.5 }]}>
        <Text style={styles.segmentFieldLabel}>Year</Text>
        <TextInput
          ref={yearRef}
          style={styles.segmentInput}
          value={val.year || ''}
          onChangeText={(t) => update('year', t)}
          placeholder="YYYY"
          placeholderTextColor={C.navyAlpha30}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
    </View>
  );
}

function EventDateStep({ answers, setAnswers }) {
  const yearRef = useRef();
  const val = answers.event_date || {};

  const update = (field, text) =>
    setAnswers((p) => ({ ...p, event_date: { ...p.event_date, [field]: text } }));

  return (
    <View style={styles.segmentRow}>
      <View style={[styles.segmentField, { flex: 1.5 }]}>
        <Text style={styles.segmentFieldLabel}>Month</Text>
        <TextInput
          style={styles.segmentInput}
          value={val.month || ''}
          onChangeText={(t) => { update('month', t); if (t.length === 2) yearRef.current?.focus(); }}
          placeholder="MM"
          placeholderTextColor={C.navyAlpha30}
          keyboardType="number-pad"
          maxLength={2}
          autoFocus
        />
      </View>
      <View style={[styles.segmentField, { flex: 2 }]}>
        <Text style={styles.segmentFieldLabel}>Year</Text>
        <TextInput
          ref={yearRef}
          style={styles.segmentInput}
          value={val.year || ''}
          onChangeText={(t) => update('year', t)}
          placeholder="YYYY"
          placeholderTextColor={C.navyAlpha30}
          keyboardType="number-pad"
          maxLength={4}
        />
      </View>
    </View>
  );
}

function SingleSelectStep({ step, answers, setAnswers }) {
  const selected = answers[step.id];
  return (
    <View style={styles.optionList}>
      {step.options.map((opt, idx) => {
        const active = selected === idx;
        return (
          <TouchableOpacity
            key={idx}
            activeOpacity={0.72}
            style={[styles.optionRow, active && styles.optionRowActive]}
            onPress={() => setAnswers((p) => ({ ...p, [step.id]: idx }))}
          >
            {opt.icon && (
              <Ionicons
                name={opt.icon}
                size={20}
                color={active ? C.accent : C.navyAlpha30}
                style={{ marginRight: 12 }}
              />
            )}
            <View style={{ flex: 1 }}>
              <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
                {opt.label}
              </Text>
              {opt.sub && (
                <Text style={[styles.optionSub, active && { color: C.accent }]}>
                  {opt.sub}
                </Text>
              )}
            </View>
            <View style={[styles.radioOuter, active && styles.radioOuterActive]}>
              {active && <View style={styles.radioInner} />}
            </View>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function MultiSelectStep({ step, answers, setAnswers }) {
  const selected = answers[step.id] || [];

  const toggle = (item) => {
    if (step.id === 'equipment' && item === 'None') {
      setAnswers((p) => ({ ...p, [step.id]: selected.includes('None') ? [] : ['None'] }));
      return;
    }
    const next = selected.includes(item)
      ? selected.filter((x) => x !== item)
      : [...selected.filter((x) => x !== 'None'), item];
    setAnswers((p) => ({ ...p, [step.id]: next }));
  };

  if (step.compact) {
    return (
      <View style={styles.dayChipRow}>
        {step.options.map((opt) => {
          const active = selected.includes(opt);
          return (
            <TouchableOpacity
              key={opt}
              activeOpacity={0.72}
              style={[styles.dayChip, active && styles.dayChipActive]}
              onPress={() => toggle(opt)}
            >
              <Text style={[styles.dayChipText, active && styles.dayChipTextActive]}>{opt}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <View style={styles.optionList}>
      {step.options.map((opt) => {
        const active = selected.includes(opt);
        return (
          <TouchableOpacity
            key={opt}
            activeOpacity={0.72}
            style={[styles.optionRow, active && styles.optionRowActive]}
            onPress={() => toggle(opt)}
          >
            <View style={[styles.checkbox, active && styles.checkboxActive]}>
              {active && <Ionicons name="checkmark" size={12} color="#fff" />}
            </View>
            <Text style={[styles.optionLabel, active && styles.optionLabelActive, { flex: 1, marginLeft: 12 }]}>
              {opt}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function StrokesDistancesStep({ answers, setAnswers }) {
  const val = answers.strokes || {};

  const toggle = (strokeId, dist) => {
    const cur = val[strokeId] || [];
    const updated = cur.includes(dist) ? cur.filter((d) => d !== dist) : [...cur, dist];
    setAnswers((p) => ({ ...p, strokes: { ...p.strokes, [strokeId]: updated } }));
  };

  return (
    <View style={styles.strokesContainer}>
      {STROKES.map((stroke) => {
        const selected = val[stroke.id] || [];
        return (
          <View key={stroke.id} style={styles.strokeBlock}>
            <Text style={styles.strokeLabel}>{stroke.label}</Text>
            <View style={styles.distanceChips}>
              {stroke.distances.map((dist) => {
                const active = selected.includes(dist);
                return (
                  <TouchableOpacity
                    key={dist}
                    activeOpacity={0.72}
                    style={[styles.distChip, active && styles.distChipActive]}
                    onPress={() => toggle(stroke.id, dist)}
                  >
                    <Text style={[styles.distChipText, active && styles.distChipTextActive]}>
                      {dist}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        );
      })}
    </View>
  );
}

function EventTimesStep({ answers, setAnswers }) {
  const val = answers.event_times || {};

  const update = (strokeId, dist, text) =>
    setAnswers((p) => ({
      ...p,
      event_times: {
        ...p.event_times,
        [strokeId]: { ...(p.event_times?.[strokeId] || {}), [dist]: text },
      },
    }));

  return (
    <View style={styles.timesContainer}>
      {STROKES.map((stroke) => (
        <View key={stroke.id} style={styles.timesStrokeBlock}>
          <Text style={styles.timesStrokeLabel}>{stroke.label}</Text>
          {stroke.distances.map((dist) => (
            <View key={dist} style={styles.timeRow}>
              <Text style={styles.timeDistLabel}>{dist}</Text>
              <TextInput
                style={styles.timeInput}
                value={val[stroke.id]?.[dist] || ''}
                onChangeText={(t) => update(stroke.id, dist, t)}
                placeholder="–:––.––"
                placeholderTextColor={C.navyAlpha30}
                keyboardType="numbers-and-punctuation"
              />
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}

// ── Progress bar ──────────────────────────────────────────────────────────────

function ProgressBar({ current, total }) {
  const fillWidth = total > 0 ? ((current / total) * (width - 32)) : 0;
  return (
    <View style={styles.progressWrapper}>
      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: fillWidth }]} />
      </View>
      <Text style={styles.progressLabel}>{current} / {total}</Text>
    </View>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function OnboardingScreen({ onComplete }) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});

  const visibleSteps = getVisibleSteps(answers);
  const currentStep = visibleSteps[stepIndex];
  const isLast = stepIndex === visibleSteps.length - 1;
  const canGo = canAdvance(currentStep, answers);

  const goNext = () => isLast ? onComplete(answers) : setStepIndex((i) => i + 1);
  const goBack = () => stepIndex > 0 && setStepIndex((i) => i - 1);

  const needsScroll = ['single_select', 'multi_select', 'strokes_distances', 'event_times'].includes(currentStep.type);

  const renderStepContent = () => {
    switch (currentStep.type) {
      case 'text_input':        return <TextInputStep step={currentStep} answers={answers} setAnswers={setAnswers} />;
      case 'dob':               return <DOBStep answers={answers} setAnswers={setAnswers} />;
      case 'event_date':        return <EventDateStep answers={answers} setAnswers={setAnswers} />;
      case 'single_select':     return <SingleSelectStep step={currentStep} answers={answers} setAnswers={setAnswers} />;
      case 'multi_select':      return <MultiSelectStep step={currentStep} answers={answers} setAnswers={setAnswers} />;
      case 'strokes_distances': return <StrokesDistancesStep answers={answers} setAnswers={setAnswers} />;
      case 'event_times':       return <EventTimesStep answers={answers} setAnswers={setAnswers} />;
      default: return null;
    }
  };

  const questionBlock = (
    <View style={styles.questionBlock}>
      <Text style={styles.question}>{currentStep.question}</Text>
      {currentStep.sub ? <Text style={styles.questionSub}>{currentStep.sub}</Text> : null}
    </View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <StatusBar style="dark" />

      {/* Top bar: back + progress */}
      <View style={styles.topBar}>
        <TouchableOpacity
          style={[styles.backBtn, stepIndex === 0 && { opacity: 0 }]}
          onPress={goBack}
          activeOpacity={0.7}
          disabled={stepIndex === 0}
        >
          <Ionicons name="arrow-back" size={20} color={C.navy} />
        </TouchableOpacity>
        <ProgressBar current={stepIndex + 1} total={visibleSteps.length} />
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {needsScroll ? (
          <ScrollView
            style={styles.flex}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {questionBlock}
            {renderStepContent()}
            <View style={{ height: 120 }} />
          </ScrollView>
        ) : (
          <View style={[styles.flex, styles.scrollContent]}>
            {questionBlock}
            {renderStepContent()}
          </View>
        )}

        {/* Footer CTA */}
        <View style={styles.footer}>
          <TouchableOpacity
            activeOpacity={canGo ? 0.85 : 1}
            style={[styles.continueBtn, !canGo && styles.continueBtnDisabled]}
            onPress={canGo ? goNext : undefined}
          >
            <Text style={[styles.continueBtnText, !canGo && styles.continueBtnTextDisabled]}>
              {isLast ? 'Get my plan' : 'Continue'}
            </Text>
            <Ionicons
              name={isLast ? 'checkmark' : 'arrow-forward'}
              size={16}
              color={canGo ? C.white : C.disabled}
            />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  flex: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 12,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: C.navyAlpha08,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Progress bar
  progressWrapper: { flex: 1, gap: 6 },
  progressTrack: {
    height: 4,
    borderRadius: 2,
    backgroundColor: C.navyAlpha15,
    overflow: 'hidden',
  },
  progressFill: {
    height: 4,
    borderRadius: 2,
    backgroundColor: C.accent,
  },
  progressLabel: {
    fontSize: 11,
    color: C.navyAlpha60,
    fontWeight: '600',
    letterSpacing: 0.4,
  },

  // Scroll content
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },

  // Question block
  questionBlock: { marginBottom: 28 },
  question: {
    fontSize: 26,
    fontWeight: '800',
    color: C.navy,
    letterSpacing: -0.4,
    lineHeight: 33,
    marginBottom: 6,
  },
  questionSub: {
    fontSize: 14,
    color: C.navyAlpha60,
    lineHeight: 20,
  },

  // Text input
  textInput: {
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.navyAlpha15,
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    fontSize: 20,
    fontWeight: '600',
    color: C.navy,
  },

  // DOB / event date segments
  segmentRow: { flexDirection: 'row', gap: 10 },
  segmentField: { flex: 1 },
  segmentFieldLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: C.navyAlpha60,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  segmentInput: {
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.navyAlpha15,
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 12,
    fontSize: 20,
    fontWeight: '700',
    color: C.navy,
    textAlign: 'center',
  },

  // Option list (single + multi select)
  optionList: { gap: 10 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.navyAlpha15,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  optionRowActive: {
    borderColor: C.accent,
    backgroundColor: C.accentBg,
  },
  optionLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: C.navy,
    lineHeight: 20,
  },
  optionLabelActive: { color: C.navy },
  optionSub: {
    fontSize: 12,
    color: C.navyAlpha60,
    marginTop: 2,
  },

  // Radio button
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: C.navyAlpha30,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  radioOuterActive: { borderColor: C.accent },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: C.accent,
  },

  // Checkbox
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: C.navyAlpha30,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },

  // Day chips (compact multi-select)
  dayChipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  dayChip: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.navyAlpha15,
    minWidth: (width - 32 - 60) / 7,
    alignItems: 'center',
  },
  dayChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  dayChipText: {
    fontSize: 13,
    fontWeight: '700',
    color: C.navy,
  },
  dayChipTextActive: { color: C.white },

  // Strokes & distances
  strokesContainer: { gap: 16 },
  strokeBlock: {
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.navyAlpha15,
    borderRadius: 14,
    padding: 16,
  },
  strokeLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: C.navy,
    letterSpacing: 0.4,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  distanceChips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  distChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: C.navyAlpha15,
    backgroundColor: C.bg,
  },
  distChipActive: {
    backgroundColor: C.accent,
    borderColor: C.accent,
  },
  distChipText: {
    fontSize: 13,
    fontWeight: '600',
    color: C.navy,
  },
  distChipTextActive: { color: C.white },

  // Event times
  timesContainer: { gap: 20 },
  timesStrokeBlock: {
    backgroundColor: C.white,
    borderWidth: 1.5,
    borderColor: C.navyAlpha15,
    borderRadius: 14,
    overflow: 'hidden',
  },
  timesStrokeLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: C.navyAlpha60,
    letterSpacing: 1,
    textTransform: 'uppercase',
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.navyAlpha08,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.navyAlpha08,
  },
  timeDistLabel: {
    width: 56,
    fontSize: 14,
    fontWeight: '700',
    color: C.navy,
  },
  timeInput: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: C.navy,
    textAlign: 'right',
    paddingVertical: 2,
  },

  // Footer / continue button
  footer: {
    paddingHorizontal: 16,
    paddingBottom: Platform.OS === 'ios' ? 12 : 20,
    paddingTop: 12,
    backgroundColor: C.bg,
    borderTopWidth: 1,
    borderTopColor: C.navyAlpha08,
  },
  continueBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.navy,
    borderRadius: 14,
    paddingVertical: 16,
    gap: 8,
  },
  continueBtnDisabled: {
    backgroundColor: C.navyAlpha15,
  },
  continueBtnText: {
    fontSize: 16,
    fontWeight: '700',
    color: C.white,
    letterSpacing: 0.3,
  },
  continueBtnTextDisabled: {
    color: C.disabled,
  },
});
