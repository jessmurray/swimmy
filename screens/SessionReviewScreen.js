import { useState } from 'react';
import {
  StyleSheet, Text, View, ScrollView,
  TouchableOpacity, SafeAreaView, Dimensions,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../lib/supabase';
import { adjustPlan } from '../services/adjustPlan';

const { width } = Dimensions.get('window');
const CARD_W = (width - 52) / 2; // 20px padding each side + 12px gap

function fmt(secs) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Palette (matches HomeScreen) ──────────────────────────────────────────────

const C = {
  bg:           '#F5F0E8',
  navy:         '#042C53',
  navyAlpha60:  'rgba(4,44,83,0.6)',
  navyAlpha30:  'rgba(4,44,83,0.3)',
  navyAlpha12:  'rgba(4,44,83,0.12)',
  navyAlpha06:  'rgba(4,44,83,0.06)',
  accent:       '#00A8E8',
  white:        '#FFFFFF',
  cardBg:       '#FFFFFF',
  cardBorder:   'rgba(4,44,83,0.08)',
  sage:         '#7BAF7B',
  gold:         '#F5A623',
  red:          '#E85555',
};

// ── Data ──────────────────────────────────────────────────────────────────────

const FEELINGS = [
  { id: 'easy',           label: 'Easy',            icon: 'sunny-outline',            color: C.sage,   desc: 'Felt comfortable throughout' },
  { id: 'as_expected',    label: 'As expected',     icon: 'checkmark-circle-outline', color: C.accent, desc: 'Right level of challenge' },
  { id: 'hard',           label: 'Hard',            icon: 'flame-outline',            color: C.gold,   desc: 'Pushed beyond my limits' },
  { id: 'couldnt_finish', label: "Couldn't finish", icon: 'alert-circle-outline',     color: C.red,    desc: 'Had to cut it short' },
];

const REASONS = {
  easy:           ['Turnaround times too slow', 'Too much rest', 'Session not long enough', 'Intensity too low'],
  as_expected:    ['Nothing to add', 'Felt stronger than usual', 'Good session', 'Ideal difficulty level'],
  hard:           ['Turnaround times too fast', 'Too little rest', 'Session too long', 'Intensity too high', 'Illness', 'Pain/Injury', 'Fatigued'],
  couldnt_finish: ['Ran out of time', 'Illness', 'Pain/Injury', 'Fatigued', 'Session too long'],
};

const RECOVERY_TRIGGERS = new Set(['Illness', 'Pain/Injury', 'Fatigued']);

// ── Step 1: Feeling ───────────────────────────────────────────────────────────

function FeelingStep({ onSelect }) {
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <Text style={s.eyebrow}>SESSION COMPLETE</Text>
        <Text style={s.heading}>How did it feel?</Text>
        <Text style={s.sub}>Tap to select</Text>
        <View style={s.feelingGrid}>
          {FEELINGS.map(f => (
            <TouchableOpacity
              key={f.id}
              style={s.feelingCard}
              onPress={() => onSelect(f.id)}
              activeOpacity={0.78}
            >
              <View style={[s.feelingCardBar, { backgroundColor: f.color }]} />
              <Ionicons name={f.icon} size={28} color={f.color} style={{ marginBottom: 12, marginTop: 6 }} />
              <Text style={s.feelingCardLabel}>{f.label}</Text>
              <Text style={s.feelingCardDesc}>{f.desc}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Step 2: Reasons ───────────────────────────────────────────────────────────

function ReasonsStep({ feeling, reasons, onToggle, onBack, onContinue }) {
  const f = FEELINGS.find(x => x.id === feeling);
  const opts = REASONS[feeling] ?? [];

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.navbar}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.navy} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <View style={[s.feelingPill, { backgroundColor: f?.color + '22', borderColor: f?.color + '55' }]}>
          <Ionicons name={f?.icon} size={14} color={f?.color} />
          <Text style={[s.feelingPillText, { color: f?.color }]}>{f?.label}</Text>
        </View>
        <Text style={s.heading}>What made it feel that way?</Text>
        <Text style={s.sub}>Select all that apply</Text>
        <View style={s.chipGrid}>
          {opts.map(o => {
            const sel = reasons.has(o);
            const isRec = RECOVERY_TRIGGERS.has(o);
            const chipColor = isRec ? C.red : (f?.color ?? C.accent);
            return (
              <TouchableOpacity
                key={o}
                style={[s.chip, sel && { backgroundColor: chipColor + '18', borderColor: chipColor + '66' }]}
                onPress={() => onToggle(o)}
                activeOpacity={0.75}
              >
                {sel && <Ionicons name="checkmark" size={14} color={chipColor} style={{ marginRight: 6 }} />}
                <Text style={[s.chipText, sel && { color: chipColor, fontWeight: '700' }]}>{o}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
      <View style={s.bottomBar}>
        <TouchableOpacity style={s.primaryBtn} onPress={onContinue} activeOpacity={0.85}>
          <Text style={s.primaryBtnText}>Continue</Text>
          <Ionicons name="arrow-forward" size={16} color={C.white} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

// ── Step 3: Recovery ──────────────────────────────────────────────────────────

function RecoveryStep({ reasons, onBack, onAnswer }) {
  const triggers = [...reasons].filter(r => RECOVERY_TRIGGERS.has(r));
  const triggerText = triggers.join(', ');

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.navbar}>
        <TouchableOpacity style={s.backBtn} onPress={onBack} activeOpacity={0.7}>
          <Ionicons name="chevron-back" size={22} color={C.navy} />
        </TouchableOpacity>
      </View>
      <ScrollView contentContainerStyle={s.page} showsVerticalScrollIndicator={false}>
        <View style={s.recoveryIcon}>
          <Ionicons name="medical-outline" size={30} color={C.red} />
        </View>
        <Text style={s.heading}>Need some recovery?</Text>
        <Text style={s.recoverySub}>
          You selected <Text style={s.recoveryTrigger}>{triggerText}</Text>. Would you like us to rearrange your upcoming sessions to allow for recovery?
        </Text>
        <View style={s.recoveryCards}>
          <TouchableOpacity style={[s.recoveryCard, s.recoveryCardYes]} onPress={() => onAnswer(true)} activeOpacity={0.82}>
            <Ionicons name="checkmark-circle" size={26} color={C.sage} />
            <View style={{ flex: 1 }}>
              <Text style={[s.recoveryCardLabel, { color: C.sage }]}>Yes please</Text>
              <Text style={s.recoveryCardSub}>Adjust my upcoming sessions</Text>
            </View>
          </TouchableOpacity>
          <TouchableOpacity style={s.recoveryCard} onPress={() => onAnswer(false)} activeOpacity={0.82}>
            <Ionicons name="close-circle-outline" size={26} color={C.navyAlpha60} />
            <View style={{ flex: 1 }}>
              <Text style={[s.recoveryCardLabel, { color: C.navy }]}>No thanks</Text>
              <Text style={s.recoveryCardSub}>Keep my plan as is</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Step 4: Processing ────────────────────────────────────────────────────────

function ProcessingStep({ msg }) {
  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <View style={s.processingCenter}>
        <ActivityIndicator size="large" color={C.accent} />
        <Text style={s.processingMsg}>{msg}</Text>
      </View>
    </SafeAreaView>
  );
}

// ── Step 5: Summary ───────────────────────────────────────────────────────────

function SummaryStep({ workout, totalElapsed, feeling, planChanged, onDone }) {
  const f = FEELINGS.find(x => x.id === feeling);

  return (
    <SafeAreaView style={s.safe}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={[s.page, { paddingTop: 52 }]} showsVerticalScrollIndicator={false}>

        <View style={s.summaryBadge}>
          <Ionicons name="trophy-outline" size={30} color={C.gold} />
        </View>
        <Text style={s.summaryTitle}>Well done!</Text>
        <Text style={s.summarySub}>{workout?.title}</Text>

        {f && (
          <View style={[s.feelingPill, { backgroundColor: f.color + '22', borderColor: f.color + '55', marginBottom: 28 }]}>
            <Ionicons name={f.icon} size={14} color={f.color} />
            <Text style={[s.feelingPillText, { color: f.color }]}>{f.label}</Text>
          </View>
        )}

        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Ionicons name="water-outline" size={20} color={C.accent} />
            <Text style={s.statValue}>{workout?.distance ?? '—'}</Text>
            <Text style={s.statLabel}>Distance</Text>
          </View>
          <View style={s.statCard}>
            <Ionicons name="time-outline" size={20} color={C.accent} />
            <Text style={s.statValue}>{fmt(totalElapsed)}</Text>
            <Text style={s.statLabel}>Time</Text>
          </View>
        </View>

        {planChanged ? (
          <View style={s.planBanner}>
            <Ionicons name="sparkles-outline" size={18} color={C.accent} />
            <Text style={s.planBannerText}>Your plan has been updated for the next two weeks based on your feedback</Text>
          </View>
        ) : (
          <View style={[s.planBanner, s.planBannerNeutral]}>
            <Ionicons name="checkmark-circle-outline" size={18} color={C.navyAlpha60} />
            <Text style={[s.planBannerText, { color: C.navyAlpha60 }]}>No plan changes — session was right on track</Text>
          </View>
        )}

        <TouchableOpacity style={s.primaryBtn} onPress={onDone} activeOpacity={0.85}>
          <Text style={s.primaryBtnText}>Back to Home</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export default function SessionReviewScreen({ workout, totalElapsed, user, plan, onPlanUpdate, onDone }) {
  const [step, setStep] = useState(1);
  const [feeling, setFeeling] = useState(null);
  const [reasons, setReasons] = useState(new Set());
  const [processingMsg, setProcessingMsg] = useState('Saving your session…');
  const [planChanged, setPlanChanged] = useState(false);

  const needsRecoveryQ = [...reasons].some(r => RECOVERY_TRIGGERS.has(r));

  const toggleReason = (r) => setReasons(prev => {
    const next = new Set(prev);
    next.has(r) ? next.delete(r) : next.add(r);
    return next;
  });

  const handleFeelingSelect = (f) => {
    setFeeling(f);
    setReasons(new Set());
    setStep(2);
  };

  const handleReasonsNext = () => {
    needsRecoveryQ ? setStep(3) : doSave(false);
  };

  const doSave = async (recovery) => {
    setStep(4);
    const reasonsList = [...reasons];

    // Save session record
    try {
      await supabase.from('completed_sessions').insert({
        user_id:             user?.id,
        date:                new Date().toISOString(),
        session_title:       workout?.title,
        week_number:         workout?.weekNumber ?? 1,
        distance:            parseInt((workout?.distance ?? '0').replace(/[^0-9]/g, ''), 10) || null,
        duration_seconds:    totalElapsed,
        feeling,
        feedback_reasons:    reasonsList,
        rearrange_requested: recovery ?? false,
      });
    } catch (e) {
      console.error('[Review] Save error:', e?.message ?? e);
    }

    // Adjust plan via Claude for any non-neutral feedback
    if (feeling !== 'as_expected' && plan) {
      setProcessingMsg('Adjusting your plan…');
      try {
        const weekIdx = (workout?.weekNumber ?? 1) - 1;
        const updated = await adjustPlan(plan, weekIdx, {
          sessionTitle:  workout?.title,
          feeling,
          reasons:       reasonsList,
          wantsRecovery: recovery ?? false,
        });
        if (updated) {
          await onPlanUpdate(updated);
          setPlanChanged(true);
        }
      } catch (e) {
        console.error('[Review] Adjust error:', e?.message ?? e);
      }
    }

    setStep(5);
  };

  if (step === 1) return <FeelingStep onSelect={handleFeelingSelect} />;

  if (step === 2) return (
    <ReasonsStep
      feeling={feeling}
      reasons={reasons}
      onToggle={toggleReason}
      onBack={() => setStep(1)}
      onContinue={handleReasonsNext}
    />
  );

  if (step === 3) return (
    <RecoveryStep
      reasons={reasons}
      onBack={() => setStep(2)}
      onAnswer={doSave}
    />
  );

  if (step === 4) return <ProcessingStep msg={processingMsg} />;

  return (
    <SummaryStep
      workout={workout}
      totalElapsed={totalElapsed}
      feeling={feeling}
      planChanged={planChanged}
      onDone={onDone}
    />
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: C.bg },
  page: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },

  navbar: { paddingHorizontal: 8, paddingVertical: 4 },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },

  eyebrow: { fontSize: 11, fontWeight: '700', color: C.navyAlpha30, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 10 },
  heading: { fontSize: 28, fontWeight: '800', color: C.navy, letterSpacing: -0.5, lineHeight: 34, marginBottom: 6 },
  sub:     { fontSize: 14, color: C.navyAlpha60, marginBottom: 28 },

  // Feeling grid
  feelingGrid:     { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  feelingCard: {
    width: CARD_W, minHeight: 148, backgroundColor: C.cardBg,
    borderRadius: 18, borderWidth: 1, borderColor: C.cardBorder,
    overflow: 'hidden', padding: 16,
    shadowColor: C.navy, shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08, shadowRadius: 10, elevation: 3,
  },
  feelingCardBar:   { position: 'absolute', top: 0, left: 0, right: 0, height: 3, borderTopLeftRadius: 18, borderTopRightRadius: 18 },
  feelingCardLabel: { fontSize: 17, fontWeight: '800', color: C.navy, marginBottom: 5 },
  feelingCardDesc:  { fontSize: 12, color: C.navyAlpha60, lineHeight: 17 },

  // Feeling pill (step 2 header + summary)
  feelingPill: {
    flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start',
    gap: 6, paddingHorizontal: 10, paddingVertical: 5,
    borderRadius: 20, borderWidth: 1, marginBottom: 14,
  },
  feelingPillText: { fontSize: 13, fontWeight: '700' },

  // Reason chips
  chipGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 14, paddingVertical: 11,
    borderRadius: 24, borderWidth: 1, borderColor: C.cardBorder, backgroundColor: C.cardBg,
  },
  chipText: { fontSize: 14, color: C.navy },

  // Recovery step
  recoveryIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: C.red + '15', borderWidth: 1, borderColor: C.red + '40',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  recoverySub:     { fontSize: 16, color: C.navyAlpha60, lineHeight: 26, marginBottom: 32 },
  recoveryTrigger: { color: C.red, fontWeight: '700' },
  recoveryCards:   { gap: 12 },
  recoveryCard: {
    flexDirection: 'row', alignItems: 'center', gap: 14,
    backgroundColor: C.cardBg, borderRadius: 16, borderWidth: 1, borderColor: C.cardBorder,
    padding: 20,
    shadowColor: C.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  recoveryCardYes:   { borderColor: C.sage + '55', backgroundColor: C.sage + '08' },
  recoveryCardLabel: { fontSize: 17, fontWeight: '800', marginBottom: 2 },
  recoveryCardSub:   { fontSize: 13, color: C.navyAlpha60 },

  // Processing
  processingCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 },
  processingMsg:    { fontSize: 16, color: C.navyAlpha60 },

  // Summary
  summaryBadge: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: C.gold + '18', borderWidth: 1.5, borderColor: C.gold + '50',
    alignItems: 'center', justifyContent: 'center', marginBottom: 18,
  },
  summaryTitle: { fontSize: 32, fontWeight: '800', color: C.navy, letterSpacing: -0.5, marginBottom: 4 },
  summarySub:   { fontSize: 16, color: C.navyAlpha60, marginBottom: 20 },
  statsRow:     { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard: {
    flex: 1, alignItems: 'center', gap: 7, paddingVertical: 20,
    backgroundColor: C.cardBg, borderRadius: 16, borderWidth: 1, borderColor: C.cardBorder,
    shadowColor: C.navy, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
  },
  statValue: { fontSize: 20, fontWeight: '800', color: C.navy },
  statLabel: { fontSize: 10, color: C.navyAlpha60, textTransform: 'uppercase', letterSpacing: 0.5 },

  planBanner: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    backgroundColor: C.accent + '12', borderWidth: 1, borderColor: C.accent + '35',
    borderRadius: 14, padding: 16, marginBottom: 32,
  },
  planBannerNeutral: { backgroundColor: C.navyAlpha06, borderColor: C.navyAlpha12 },
  planBannerText:    { flex: 1, fontSize: 14, color: C.accent, lineHeight: 20, fontWeight: '500' },

  // Bottom CTA bar (reasons step)
  bottomBar: {
    paddingHorizontal: 20, paddingVertical: 16,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.navyAlpha12,
  },
  primaryBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: C.navy, borderRadius: 14, paddingVertical: 15,
  },
  primaryBtnText: { fontSize: 16, fontWeight: '700', color: C.white, letterSpacing: 0.2 },
});
