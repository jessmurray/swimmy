import { useReducer, useEffect, useRef, useMemo, useState, useCallback } from 'react';
import {
  StyleSheet, Text, View, Pressable, TouchableOpacity,
  SafeAreaView, Dimensions,
} from 'react-native';
import SessionReviewScreen from './SessionReviewScreen';
import { StatusBar } from 'expo-status-bar';
import { Ionicons } from '@expo/vector-icons';
import { useKeepAwake } from 'expo-keep-awake';

const { width: SW } = Dimensions.get('window');

// ── Colours ───────────────────────────────────────────────────────────────────

const C = {
  bg:     '#042C53',
  accent: '#00A8E8',
  label:  '#042C53',
  white:  '#FFFFFF',
  w80: 'rgba(255,255,255,0.80)',
  w60: 'rgba(255,255,255,0.60)',
  w40: 'rgba(255,255,255,0.40)',
  w30: 'rgba(255,255,255,0.30)',
  w20: 'rgba(255,255,255,0.20)',
  w10: 'rgba(255,255,255,0.10)',
  w06: 'rgba(255,255,255,0.06)',
  sage: '#7BAF7B',
  gold: '#F5A623',
  red:  '#E85555',
};

// ── Utilities ─────────────────────────────────────────────────────────────────

function fmt(secs) {
  const m = Math.floor(Math.abs(secs) / 60);
  const s = Math.abs(secs) % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// ── Step parsing ──────────────────────────────────────────────────────────────

function parseTurnaroundSecs(detail) {
  const m = detail.match(/\bon\s+(\d+):(\d+)/i);
  if (m) return parseInt(m[1]) * 60 + parseInt(m[2]);
  const m2 = detail.match(/\bon\s+:(\d+)/i);
  if (m2) return parseInt(m2[1]);
  return null;
}

function parseRestSecs(detail) {
  // "· 1:30 rest"
  const m1 = detail.match(/[·•,]\s*(\d+):(\d+)\s*rest/i);
  if (m1) return parseInt(m1[1]) * 60 + parseInt(m1[2]);
  // " :30 rest"  or  ",:20 rest"
  const m2 = detail.match(/[·•,\s]:(\d+)\s*rest/i);
  if (m2) return parseInt(m2[1]);
  // "· 30s rest"
  const m3 = detail.match(/[·•,]\s*(\d+)s\s*rest/i);
  if (m3) return parseInt(m3[1]);
  return null;
}

function parseReps(detail) {
  const m = detail.match(/^(\d+)\s*[×xX(]/);
  if (m) return parseInt(m[1]);
  return 1;
}

function stripRest(str) {
  return str
    .replace(/\s*[·•]\s*\d+:\d+\s*rest\s*/gi, '')
    .replace(/\s*[·•]\s*:\d+\s*rest\s*/gi, '')
    .replace(/\s*[·•]\s*\d+s\s*rest\s*/gi, '')
    .trim();
}

// Converts a workout's sets array into a flat list of executable steps.
function buildSteps(workout) {
  if (!workout?.sets?.length) return [];
  const steps = [];
  let prevLabel = null;

  for (const set of workout.sets) {
    const { label, detail } = set;
    const isEdge     = label === 'Warm-up' || label === 'Cool-down';
    const isMainSect = label === 'Pre-set'  || label === 'Main set';
    const isFirst    = label !== prevLabel;
    prevLabel = label;

    if (isEdge) {
      // Split warm-up / cool-down segments by ' + '
      detail.split(/\s*\+\s*/).forEach(seg => {
        steps.push({
          setLabel:        label,
          description:     stripRest(seg) || seg,
          type:            'stopwatch',
          reps:            1,
          intervalSeconds: 0,
          restSeconds:     parseRestSecs(seg) ?? 20,
          showIntro:       false,
        });
      });
    } else {
      const turnaround = parseTurnaroundSecs(detail);
      steps.push({
        setLabel:        label,
        description:     detail,
        type:            turnaround ? 'turnaround' : 'stopwatch',
        reps:            turnaround ? Math.max(parseReps(detail), 1) : 1,
        intervalSeconds: turnaround ?? 0,
        restSeconds:     parseRestSecs(detail) ?? (turnaround ? 0 : 30),
        showIntro:       isMainSect && isFirst,
      });
    }
  }

  return steps;
}

// ── State machine ─────────────────────────────────────────────────────────────
// phases: pre_start → countdown → (set_intro →) active ↔ rest → … → tap_confirm → … → complete
//         any active phase → paused → resume

const INIT = {
  phase:           'pre_start',
  countdownVal:    3,
  introCountdown:  10,
  stepIdx:         0,
  repIdx:          0,
  elapsed:         0,
  countdown:       0,
  restRemaining:   0,
  pausedPhase:     null,
  totalElapsed:    0,
  setsCompleted:   0,
  intervalAdjust:  0,
  restAdjust:      0,
};

function gotoStep(idx, state, steps) {
  if (idx >= steps.length) return { ...state, phase: 'complete', stepIdx: idx };
  const s = steps[idx];
  const resetAdj = { intervalAdjust: 0, restAdjust: 0 };
  if (s.showIntro) return { ...state, ...resetAdj, phase: 'set_intro', stepIdx: idx, introCountdown: 10, repIdx: 0 };
  if (s.type === 'turnaround') return { ...state, ...resetAdj, phase: 'active', stepIdx: idx, repIdx: 0, countdown: s.intervalSeconds, elapsed: 0 };
  return { ...state, ...resetAdj, phase: 'active', stepIdx: idx, repIdx: 0, elapsed: 0, countdown: 0 };
}

function nextStep(state, steps) {
  return gotoStep(state.stepIdx + 1, { ...state, setsCompleted: state.setsCompleted + 1 }, steps);
}

function workoutReducer(state, action) {
  const steps = action.steps ?? [];
  const step  = steps[state.stepIdx];

  switch (action.type) {

    case 'TICK': {
      const t = state.totalElapsed + 1;

      if (state.phase === 'countdown') {
        // 3 → 2 → 1 → 0 ("GO!") → first step
        if (state.countdownVal === 0) return gotoStep(0, { ...state, totalElapsed: t }, steps);
        if (state.countdownVal === 1) return { ...state, countdownVal: 0, totalElapsed: t };
        return { ...state, countdownVal: state.countdownVal - 1, totalElapsed: t };
      }

      if (state.phase === 'set_intro') {
        if (state.introCountdown <= 1) {
          const s = steps[state.stepIdx];
          if (s?.type === 'turnaround') return { ...state, phase: 'active', countdown: s.intervalSeconds, repIdx: 0, totalElapsed: t };
          return { ...state, phase: 'active', elapsed: 0, totalElapsed: t };
        }
        return { ...state, introCountdown: state.introCountdown - 1, totalElapsed: t };
      }

      if (state.phase === 'active') {
        if (!step) return { ...state, phase: 'complete', totalElapsed: t };
        if (step.type === 'stopwatch') return { ...state, elapsed: state.elapsed + 1, totalElapsed: t };
        if (step.type === 'turnaround') {
          if (state.countdown <= 1) {
            const nr = state.repIdx + 1;
            if (nr >= step.reps) return { ...state, phase: 'tap_confirm', repIdx: nr, totalElapsed: t };
            return { ...state, repIdx: nr, countdown: step.intervalSeconds + state.intervalAdjust, totalElapsed: t };
          }
          return { ...state, countdown: state.countdown - 1, totalElapsed: t };
        }
      }

      if (state.phase === 'rest') {
        if (state.restRemaining <= 1) return nextStep({ ...state, totalElapsed: t }, steps);
        return { ...state, restRemaining: state.restRemaining - 1, totalElapsed: t };
      }

      return { ...state, totalElapsed: t };
    }

    case 'TAP_START':
      return state.phase === 'pre_start' ? { ...state, phase: 'countdown', countdownVal: 3 } : state;

    case 'TAP_ACTIVE':
      if (state.phase !== 'active' || step?.type !== 'stopwatch') return state;
      return step.restSeconds > 0
        ? { ...state, phase: 'rest', restRemaining: step.restSeconds + state.restAdjust }
        : nextStep(state, steps);

    case 'TAP_CONFIRM':
      if (state.phase !== 'tap_confirm') return state;
      return step?.restSeconds > 0
        ? { ...state, phase: 'rest', restRemaining: step.restSeconds + state.restAdjust, repIdx: 0 }
        : nextStep(state, steps);

    case 'PAUSE': {
      const ok = ['active', 'rest', 'set_intro', 'tap_confirm'];
      return ok.includes(state.phase) ? { ...state, phase: 'paused', pausedPhase: state.phase } : state;
    }
    case 'RESUME':
      return state.phase === 'paused' ? { ...state, phase: state.pausedPhase ?? 'active', pausedPhase: null } : state;

    case 'SKIP_REP': {
      if (state.phase !== 'active' || step?.type !== 'turnaround') return state;
      const nr = state.repIdx + 1;
      return nr >= step.reps
        ? { ...state, phase: 'tap_confirm', repIdx: nr }
        : { ...state, repIdx: nr, countdown: step.intervalSeconds + state.intervalAdjust };
    }

    case 'SKIP_REST':
      return state.phase === 'rest' ? nextStep(state, steps) : state;

    case 'SKIP_SET': {
      const ok = ['active', 'rest', 'tap_confirm', 'set_intro'];
      return ok.includes(state.phase) ? nextStep(state, steps) : state;
    }

    case 'ADJUST_INTERVAL': {
      if (state.phase !== 'active') return state;
      const base = step?.intervalSeconds ?? 5;
      const newAdj = Math.max(5 - base, state.intervalAdjust + action.delta);
      const diff = newAdj - state.intervalAdjust;
      return { ...state, intervalAdjust: newAdj, countdown: Math.max(1, state.countdown + diff) };
    }

    case 'ADJUST_REST': {
      if (state.phase !== 'rest') return state;
      const base = step?.restSeconds ?? 5;
      const newAdj = Math.max(5 - base, state.restAdjust + action.delta);
      const diff = newAdj - state.restAdjust;
      return { ...state, restAdjust: newAdj, restRemaining: Math.max(1, state.restRemaining + diff) };
    }

    default: return state;
  }
}

function fmtAdjust(secs) {
  if (secs === 0) return '+0s';
  return secs > 0 ? `+${secs}s` : `${secs}s`;
}

// ── Sub-views ─────────────────────────────────────────────────────────────────

function ModifyRow({ adjust, onMinus, onPlus }) {
  return (
    <View style={sv.modifyRow}>
      <TouchableOpacity style={sv.modifyBtn} onPress={onMinus} activeOpacity={0.7} hitSlop={10}>
        <Text style={sv.modifyBtnText}>−</Text>
      </TouchableOpacity>
      <Text style={sv.modifyAdjust}>{fmtAdjust(adjust)}</Text>
      <TouchableOpacity style={sv.modifyBtn} onPress={onPlus} activeOpacity={0.7} hitSlop={10}>
        <Text style={sv.modifyBtnText}>+</Text>
      </TouchableOpacity>
    </View>
  );
}

function PreStartView({ workout }) {
  const warmupSegments = [];
  (workout?.sets ?? [])
    .filter(s => s.label === 'Warm-up')
    .forEach(s => s.detail.split(/\s*\+\s*/).forEach(seg => {
      warmupSegments.push(stripRest(seg) || seg);
    }));
  return (
    <View style={sv.center}>
      <Text style={sv.preTitle}>{workout?.title}</Text>
      <Text style={sv.preMeta}>{workout?.distance}  ·  {workout?.duration}</Text>
      <View style={{ height: 52 }} />
      <Ionicons name="hand-right-outline" size={28} color={C.w20} />
      <Text style={sv.tapLabel}>TAP ANYWHERE TO BEGIN</Text>
      {warmupSegments.length > 0 && (
        <View style={sv.warmupPreview}>
          <Text style={sv.warmupPreviewTitle}>WARM-UP</Text>
          {warmupSegments.map((seg, i) => (
            <View key={i} style={sv.warmupRow}>
              <View style={sv.warmupDot} />
              <Text style={sv.warmupText}>{seg}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

function CountdownView({ val }) {
  return (
    <View style={sv.center}>
      <Text style={val === 0 ? sv.goText : sv.countdownNum}>
        {val === 0 ? 'GO!' : val}
      </Text>
    </View>
  );
}

function SetIntroView({ step, countdown }) {
  return (
    <View style={sv.center}>
      <Text style={sv.introTag}>COMING UP</Text>
      <Text style={sv.introSection}>{step?.setLabel?.toUpperCase()}</Text>
      <Text style={sv.introDesc}>{step?.description}</Text>
      <Text style={sv.introTimer}>Starting in {countdown}s</Text>
    </View>
  );
}

function StopwatchView({ step, elapsed }) {
  return (
    <View style={sv.center}>
      <Text style={sv.setLabelTag}>{step?.setLabel?.toUpperCase()}</Text>
      <Text style={sv.setDescLarge}>{step?.description}</Text>
      <Text style={sv.stopwatchTime}>{fmt(elapsed)}</Text>
      <Text style={sv.actionHint}>TAP WHEN DONE</Text>
    </View>
  );
}

function TurnaroundView({ step, countdown, repIdx, adjust, onMinus, onPlus }) {
  return (
    <View style={sv.center}>
      <Text style={sv.turnaroundHeader} numberOfLines={2}>{step?.description}</Text>
      <Text style={sv.turnaroundTimer}>{fmt(countdown)}</Text>
      <Text style={sv.repCounter}>{repIdx + 1} / {step?.reps}</Text>
      <ModifyRow adjust={adjust} onMinus={onMinus} onPlus={onPlus} />
    </View>
  );
}

function TapConfirmView({ step }) {
  return (
    <View style={sv.center}>
      <View style={sv.doneRing}>
        <Ionicons name="checkmark" size={40} color={C.white} />
      </View>
      <Text style={sv.setCompleteTag}>SET COMPLETE</Text>
      <Text style={sv.setDescMed}>{step?.description}</Text>
      <Text style={sv.repsDoneText}>{step?.reps} / {step?.reps} reps</Text>
      <Text style={sv.actionHint}>TAP TO CONTINUE →</Text>
    </View>
  );
}

function RestView({ remaining, nextStep: ns, adjust, onMinus, onPlus }) {
  return (
    <View style={sv.center}>
      <Text style={sv.restTag}>REST</Text>
      <Text style={sv.restTimer}>{remaining}</Text>
      <ModifyRow adjust={adjust} onMinus={onMinus} onPlus={onPlus} />
      {ns && (
        <View style={sv.nextBox}>
          <Text style={sv.nextTag}>NEXT</Text>
          <Text style={sv.nextDesc} numberOfLines={2}>{ns.description}</Text>
        </View>
      )}
    </View>
  );
}

function PausedView() {
  return (
    <View style={[sv.center, { backgroundColor: 'rgba(0,0,0,0.55)' }]}>
      <Ionicons name="pause-circle-outline" size={72} color={C.w40} />
      <Text style={sv.pausedTitle}>PAUSED</Text>
      <Text style={sv.pausedSub}>Tap anywhere to resume</Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function WorkoutScreen({ workout, user, plan, onPlanUpdate, onBack }) {
  useKeepAwake();

  // Steps are fixed at mount — workout won't change during a session
  const steps = useMemo(() => buildSteps(workout), []); // eslint-disable-line react-hooks/exhaustive-deps

  const [state, dispatch] = useReducer(workoutReducer, INIT);
  const timerRef  = useRef(null);
  const tapCtRef  = useRef(0);
  const tapTmRef  = useRef(null);
  const holdTmRef = useRef(null);

  const [showHoldHint, setShowHoldHint] = useState(false);

  // Tick timer — clear and restart whenever phase changes
  useEffect(() => {
    const TICK_PHASES = ['countdown', 'set_intro', 'active', 'rest'];
    clearInterval(timerRef.current);
    if (!TICK_PHASES.includes(state.phase)) return;
    timerRef.current = setInterval(() => dispatch({ type: 'TICK', steps }), 1000);
    return () => clearInterval(timerRef.current);
  }, [state.phase]); // `steps` is frozen at mount

  // Left 55 % of screen = advance / confirm / resume
  // Right 45 % of screen = double-tap skip rep, quad-tap skip set
  const handlePress = useCallback((e) => {
    // locationX = touch; offsetX = web mouse click fallback
    const x = e?.nativeEvent?.locationX ?? e?.nativeEvent?.offsetX ?? 0;
    const isRight = x > SW * 0.55;

    if (isRight && ['active', 'rest', 'tap_confirm'].includes(state.phase)) {
      tapCtRef.current += 1;
      clearTimeout(tapTmRef.current);
      tapTmRef.current = setTimeout(() => {
        const n = tapCtRef.current;
        tapCtRef.current = 0;
        if      (n >= 4) dispatch({ type: 'SKIP_SET', steps });
        else if (n >= 2) {
          if (state.phase === 'rest') dispatch({ type: 'SKIP_REST', steps });
          else dispatch({ type: 'SKIP_REP', steps });
        }
      }, 400);
      return;
    }

    if (state.phase === 'pre_start')    dispatch({ type: 'TAP_START' });
    if (state.phase === 'active')       dispatch({ type: 'TAP_ACTIVE', steps });
    if (state.phase === 'tap_confirm')  dispatch({ type: 'TAP_CONFIRM', steps });
    if (state.phase === 'paused')       dispatch({ type: 'RESUME' });
  }, [state.phase, steps]);

  const handleLongPress = useCallback(() => {
    setShowHoldHint(false);
    dispatch({ type: 'PAUSE' });
  }, []);

  const handlePressIn  = useCallback(() => {
    holdTmRef.current = setTimeout(() => setShowHoldHint(true), 800);
  }, []);

  const handlePressOut = useCallback(() => {
    clearTimeout(holdTmRef.current);
    setShowHoldHint(false);
  }, []);

  const currentStep = steps[state.stepIdx] ?? null;
  const nextStepVal = steps[state.stepIdx + 1] ?? null;

  if (state.phase === 'complete') {
    return (
      <SessionReviewScreen
        workout={workout}
        totalElapsed={state.totalElapsed}
        user={user}
        plan={plan}
        onPlanUpdate={onPlanUpdate}
        onDone={onBack}
      />
    );
  }

  const showHints = !['pre_start', 'countdown'].includes(state.phase);

  return (
    <View style={styles.screen}>
      <StatusBar style="light" />
      <SafeAreaView style={styles.safe}>

        {/* ── Navbar ── */}
        <View style={styles.navbar}>
          <TouchableOpacity style={styles.navBtn} onPress={onBack} activeOpacity={0.6}>
            <Ionicons name="close" size={22} color={C.w40} />
          </TouchableOpacity>
          <View style={styles.navCenter}>
            <Text style={styles.navTitle} numberOfLines={1}>{workout?.title}</Text>
            {state.phase !== 'pre_start' && (
              <Text style={styles.navElapsed}>{fmt(state.totalElapsed)}</Text>
            )}
          </View>
          <View style={styles.navBtn} />
        </View>

        {/* ── Interactive area ── */}
        <Pressable
          style={styles.mainArea}
          onPress={handlePress}
          onLongPress={handleLongPress}
          onPressIn={handlePressIn}
          onPressOut={handlePressOut}
          delayLongPress={3000}
        >
          {state.phase === 'pre_start'   && <PreStartView workout={workout} />}
          {state.phase === 'countdown'   && <CountdownView val={state.countdownVal} />}
          {state.phase === 'set_intro'   && <SetIntroView step={currentStep} countdown={state.introCountdown} />}

          {state.phase === 'active' && currentStep?.type === 'stopwatch'   &&
            <StopwatchView step={currentStep} elapsed={state.elapsed} />}
          {state.phase === 'active' && currentStep?.type === 'turnaround'  &&
            <TurnaroundView
              step={currentStep} countdown={state.countdown} repIdx={state.repIdx}
              adjust={state.intervalAdjust}
              onMinus={() => dispatch({ type: 'ADJUST_INTERVAL', delta: -5, steps })}
              onPlus={() =>  dispatch({ type: 'ADJUST_INTERVAL', delta:  5, steps })}
            />}

          {state.phase === 'tap_confirm' && <TapConfirmView step={currentStep} />}
          {state.phase === 'rest' &&
            <RestView
              remaining={state.restRemaining} nextStep={nextStepVal}
              adjust={state.restAdjust}
              onMinus={() => dispatch({ type: 'ADJUST_REST', delta: -5, steps })}
              onPlus={() =>  dispatch({ type: 'ADJUST_REST', delta:  5, steps })}
            />}
          {state.phase === 'paused'      && <PausedView />}

          {/* Hold-to-pause progress hint */}
          {showHoldHint && state.phase !== 'paused' && (
            <View style={styles.holdBubble} pointerEvents="none">
              <Text style={styles.holdBubbleText}>Keep holding to pause…</Text>
            </View>
          )}

        </Pressable>

        {/* ── Bottom hint bar ── */}
        {showHints && (
          <View style={styles.bottomBar}>
            <Text style={styles.bottomHint}>Hold 3s to pause</Text>
            <View style={styles.bottomDot} />
            <Text style={styles.bottomHint}>Tap right side to skip</Text>
          </View>
        )}
      </SafeAreaView>
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: C.bg },
  safe:   { flex: 1 },

  navbar: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: C.w10,
  },
  navBtn:    { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  navCenter: { flex: 1, alignItems: 'center' },
  navTitle:  { fontSize: 14, fontWeight: '700', color: C.w80, letterSpacing: 0.2 },
  navElapsed: { fontSize: 11, color: C.w40, marginTop: 1, letterSpacing: 0.5 },

  mainArea: { flex: 1 },

  holdBubble: {
    position: 'absolute', bottom: 80, alignSelf: 'center',
    paddingHorizontal: 18, paddingVertical: 9, borderRadius: 24,
    backgroundColor: C.w10,
  },
  holdBubbleText: { fontSize: 13, color: C.w60 },

  rightHints: {
    position: 'absolute', right: 16, top: '42%',
    alignItems: 'flex-end', gap: 4,
  },
  rightHintLine: { fontSize: 10, color: C.w20, letterSpacing: 0.3 },

  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    paddingVertical: 10, gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.w10,
  },
  bottomHint: { fontSize: 11, color: C.w30, letterSpacing: 0.3 },
  bottomDot:  { width: 3, height: 3, borderRadius: 2, backgroundColor: C.w20 },

});

const sv = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },

  // Pre-start
  preTitle: { fontSize: 32, fontWeight: '800', color: C.white, textAlign: 'center', letterSpacing: -0.5, marginBottom: 8 },
  preMeta:  { fontSize: 14, color: C.w40, letterSpacing: 0.3 },
  tapLabel: { fontSize: 17, fontWeight: '700', color: C.white, letterSpacing: 2, marginTop: 14 },

  // Countdown
  countdownNum: { fontSize: 120, fontWeight: '900', color: C.white, lineHeight: 134 },
  goText:       { fontSize: 64,  fontWeight: '900', color: C.white, letterSpacing: 4 },

  // Set intro
  introTag:      { fontSize: 11, fontWeight: '800', color: C.accent, letterSpacing: 2, marginBottom: 10 },
  introSection:  { fontSize: 20, fontWeight: '800', color: C.white, letterSpacing: 1, marginBottom: 18 },
  introDesc:     { fontSize: 18, color: C.w80, textAlign: 'center', lineHeight: 28, marginBottom: 28 },
  introTimer:    { fontSize: 13, color: C.w40 },

  // Stopwatch
  setLabelTag:   { fontSize: 11, fontWeight: '700', color: C.accent, letterSpacing: 1.5, marginBottom: 18 },
  setDescLarge:  { fontSize: 22, fontWeight: '700', color: C.white, textAlign: 'center', lineHeight: 30, marginBottom: 24 },
  stopwatchTime: { fontSize: 64, fontWeight: '200', color: C.white, letterSpacing: -1, marginBottom: 20 },
  actionHint:    { fontSize: 11, color: C.w30, letterSpacing: 1.5 },

  // Turnaround
  turnaroundHeader: { fontSize: 14, color: C.w60, textAlign: 'center', lineHeight: 22, marginBottom: 24 },
  turnaroundTimer:  { fontSize: 88, fontWeight: '200', color: C.white, letterSpacing: -2 },
  repCounter:       { fontSize: 24, color: C.w40, marginTop: 14, fontWeight: '300', letterSpacing: 3 },

  // Tap confirm
  doneRing: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 2, borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center', justifyContent: 'center', marginBottom: 20,
  },
  setCompleteTag: { fontSize: 13, fontWeight: '800', color: C.accent, letterSpacing: 2, marginBottom: 14 },
  setDescMed:     { fontSize: 18, color: C.w80, textAlign: 'center', lineHeight: 26, marginBottom: 8 },
  repsDoneText:   { fontSize: 14, color: C.w40, marginBottom: 28 },

  // Rest
  restTag:   { fontSize: 13, fontWeight: '800', color: C.accent, letterSpacing: 2, marginBottom: 8 },
  restTimer: { fontSize: 100, fontWeight: '200', color: C.white, lineHeight: 112 },
  nextBox:   { marginTop: 36, alignItems: 'center' },
  nextTag:   { fontSize: 11, fontWeight: '700', color: C.w60, letterSpacing: 2, marginBottom: 12 },
  nextDesc:  { fontSize: 24, fontWeight: '700', color: C.white, textAlign: 'center', lineHeight: 32, maxWidth: SW - 48 },

  // Paused
  pausedTitle: { fontSize: 24, fontWeight: '800', color: C.white, letterSpacing: 3, marginTop: 18, marginBottom: 10 },
  pausedSub:   { fontSize: 13, color: C.w40 },

  // Modify row (turnaround + rest)
  modifyRow:    { flexDirection: 'row', alignItems: 'center', gap: 16, marginTop: 22 },
  modifyBtn:    {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,168,232,0.22)', borderWidth: 1, borderColor: 'rgba(0,168,232,0.45)',
    alignItems: 'center', justifyContent: 'center',
  },
  modifyBtnText:  { fontSize: 20, fontWeight: '400', color: C.white, lineHeight: 24 },
  modifyAdjust:   { fontSize: 13, fontWeight: '600', color: C.w60, width: 44, textAlign: 'center', letterSpacing: 0.3 },

  // Warm-up preview on pre-start screen
  warmupPreview:      { marginTop: 40, width: '100%', borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: C.w20, paddingTop: 24 },
  warmupPreviewTitle: { fontSize: 10, fontWeight: '800', color: C.white, letterSpacing: 2, marginBottom: 14 },
  warmupRow:          { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 11 },
  warmupDot:          { width: 5, height: 5, borderRadius: 3, backgroundColor: C.white, flexShrink: 0, marginTop: 8 },
  warmupText:         { fontSize: 16, color: C.white, flex: 1, lineHeight: 22 },
});
