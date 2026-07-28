const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const RECOVERY_TRIGGERS = new Set(['Illness', 'Pain/Injury', 'Fatigued']);

// JS Date.getDay() is 0=Sun; our DAYS is 0=Mon, so shift by 6.
function todayDayIndex() {
  return (new Date().getDay() + 6) % 7;
}

// "Base" category = Recovery / Technique / Aerobic Base (easy).
// Build and Sharpen are intense and should be downgraded.
function isIntense(session) {
  return session.category !== 'Base';
}

function makeEasySession(session, reasons) {
  const type = reasons.includes('Pain/Injury') ? 'Technique' : 'Recovery';
  return {
    ...session,
    title:     `${type} Session`,
    category:  'Base',
    intensity: 'Easy',
    sets: [
      { label: 'Warm-up',   detail: '200m easy choice · 30s rest' },
      { label: 'Main set',  detail: type === 'Technique'
          ? '8×50m drill focus · 20s rest'
          : '4×100m easy FR · 20s rest' },
      { label: 'Cool-down', detail: '200m easy backstroke' },
    ],
  };
}

/**
 * Deterministically adjusts the current week based on post-session recovery triggers.
 *
 * @param {object}   plan               - Full plan object
 * @param {object}   workout            - Completed workout (must have weekNumber)
 * @param {string[]} reasons            - Selected feedback reasons
 * @param {boolean}  rearrangeRequested - Whether the user answered Yes to rearranging
 * @param {boolean}  isSecondTrigger    - Whether the previous session also had recovery triggers
 * @returns {object|null}               - Updated plan, or null if nothing to change
 */
export function rearrangePlan(plan, workout, reasons, rearrangeRequested, isSecondTrigger) {
  if (!reasons.some(r => RECOVERY_TRIGGERS.has(r))) return null;

  const weekIdx = plan.weeks.findIndex(w => w.week === workout.weekNumber);
  if (weekIdx === -1) return null;

  const todayIdx    = todayDayIndex();
  const remainingDays = new Set(DAYS.slice(todayIdx + 1));

  let sessions = [...plan.weeks[weekIdx].sessions];

  if (isSecondTrigger) {
    // Second consecutive trigger: remove all remaining sessions this week.
    sessions = sessions.filter(s => !remainingDays.has(s.day));

  } else if (rearrangeRequested) {
    // Rule 1: push tomorrow's session back by one day (if there is a day after).
    const tomorrow       = DAYS[todayIdx + 1];
    const dayAfterTomorrow = todayIdx + 2 < 7 ? DAYS[todayIdx + 2] : null;
    if (tomorrow && dayAfterTomorrow) {
      sessions = sessions.map(s =>
        s.day === tomorrow ? { ...s, day: dayAfterTomorrow } : s
      );
    }
    // Rule 2: downgrade all intense sessions still remaining this week.
    sessions = sessions.map(s =>
      remainingDays.has(s.day) && isIntense(s) ? makeEasySession(s, reasons) : s
    );

  } else {
    // Rule 4: user declined rearranging — make remaining sessions easy anyway.
    sessions = sessions.map(s =>
      remainingDays.has(s.day) && isIntense(s) ? makeEasySession(s, reasons) : s
    );
  }

  return {
    ...plan,
    weeks: plan.weeks.map((w, i) => i === weekIdx ? { ...w, sessions } : w),
  };
}
