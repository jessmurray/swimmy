import Anthropic from '@anthropic-ai/sdk';

const SYSTEM = `You are an expert swimming coach adjusting a training plan based on athlete feedback.

Return ONLY valid JSON — no markdown fences, no explanation, no text before or after.

Return structure: { "weeks": [ ...same number of weeks as provided... ] }

Adjustment rules:
- Easy / too slow: tighten turnaround times 5-10s (e.g. "on 1:40" → "on 1:32"), reduce rest 10-20%, consider adding a rep
- Hard / couldn't finish: loosen turnaround times 5-15s, increase rest 10-30%, reduce reps or distance if session was too long
- Illness / Pain/Injury / Fatigued (with recovery): replace first 3-4 upcoming sessions with easy aerobic (50-60% effort) or mobility; cut distances 30-50%
- As expected: return the weeks unchanged
- Recovery weeks (theme contains "Recovery"): preserve their reduced intensity even if adjusting
- Keep the same session days — never add or remove sessions
- Preserve set structure: always include Warm-up, Pre-set or equivalent, Main set, Cool-down
- Interval sets (reps): turnaround format "on M:SS" (e.g. "8×100m @ CSS on 1:40")
- Non-interval segments: include rest "· Xs rest" or "· M:SS rest"
- Keep each detail string under 65 characters`;

export async function adjustPlan(plan, weekIdx, feedback) {
  const toAdjust = [plan.weeks[weekIdx + 1], plan.weeks[weekIdx + 2]].filter(Boolean);
  if (toAdjust.length === 0) return null;

  const client = new Anthropic({
    apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true,
    timeout: 120000,
  });

  const feedbackLines = [
    `Completed session: "${feedback.sessionTitle}" (Week ${weekIdx + 1})`,
    `How it felt: ${feedback.feeling.replace(/_/g, ' ')}`,
    feedback.reasons.length ? `Reasons: ${feedback.reasons.join(', ')}` : null,
    feedback.wantsRecovery ? 'Recovery requested: yes — ease upcoming sessions' : null,
  ].filter(Boolean).join('\n');

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 8000,
    system: [{ type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Athlete feedback:\n${feedbackLines}\n\nWeeks to adjust:\n${JSON.stringify({ weeks: toAdjust })}`,
    }],
  });

  const message = await stream.finalMessage();
  const raw = message.content[0]?.text ?? '';
  const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '').trim();

  let parsed;
  try {
    parsed = JSON.parse(jsonStr);
  } catch (e) {
    console.error('[adjustPlan] JSON parse error:', e.message, '\nRaw:', raw.slice(0, 200));
    return null;
  }

  const adjustedWeeks = Array.isArray(parsed.weeks) ? parsed.weeks : [];
  if (adjustedWeeks.length === 0) return null;

  return {
    ...plan,
    weeks: plan.weeks.map((w, i) => {
      if (i === weekIdx + 1 && adjustedWeeks[0]) return adjustedWeeks[0];
      if (i === weekIdx + 2 && adjustedWeeks[1]) return adjustedWeeks[1];
      return w;
    }),
  };
}
