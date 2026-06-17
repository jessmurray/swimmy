import Anthropic from '@anthropic-ai/sdk';

const GOALS = [
  'Improve general fitness',
  'Cross-train or complement another sport',
  'Get back into swimming after a break',
  'Get faster at a stroke or distance',
  'Train for an event, gala or competition',
  'Train for a triathlon',
];
const TRAINING_DAYS  = ['1–2 days per week', '3–4 days per week', '5–7 days per week'];
const SESSION_LENGTHS = ['15 minutes', '30 minutes', '45 minutes', '60 minutes', '90 minutes', '120+ minutes'];
const POOL_LENGTHS   = ['25m pool (short course)', '50m pool (long course / Olympic)', 'Both 25m and 50m'];
const LEVELS         = ['Casual', 'Fitness', 'Club', 'Competitive', 'Former competitive'];

function formatProfileText(meta) {
  const events = meta.events
    ? Object.entries(meta.events)
        .filter(([, dists]) => dists.length > 0)
        .map(([stroke, dists]) => `${stroke}: ${dists.join(', ')}`)
        .join('; ')
    : 'not specified';

  return [
    `Goal: ${GOALS[meta.goal] || 'not specified'}`,
    `Training frequency: ${TRAINING_DAYS[meta.training_days] || 'not specified'}`,
    `Swim days: ${(meta.swim_days || []).join(', ')}`,
    `Session length: ${SESSION_LENGTHS[meta.session_length] || 'not specified'}`,
    `Pool: ${POOL_LENGTHS[meta.pool_length] || 'not specified'}`,
    `Equipment: ${(meta.equipment || []).join(', ') || 'none'}`,
    `Level: ${LEVELS[meta.level] || 'not specified'}`,
    `Focus events: ${events}`,
  ].join('\n');
}

// Generates remaining weeks of the 12-week plan using updated preferences.
// completedWeekCount: 0-indexed count of weeks already done (e.g. 3 = keep weeks 1–3, generate 4–12).
// Returns an array of week objects.
export async function regeneratePlan(meta, completedWeekCount) {
  const totalWeeks      = 12;
  const weeksToGenerate = totalWeeks - completedWeekCount;
  const startWeek       = completedWeekCount + 1;

  const systemPrompt = `You are an expert swimming coach. Generate weeks ${startWeek}–${totalWeeks} of a 12-week training plan as JSON.

Return ONLY valid JSON — no markdown fences, no explanation, no text before or after.

Required structure:
{
  "weeks": [
    {
      "week": ${startWeek},
      "theme": "Foundation",
      "sessions": [
        {
          "day": "Mon",
          "title": "Easy Aerobic",
          "category": "Base",
          "intensity": "Easy",
          "distance": "2000m",
          "duration": "40 min",
          "sets": [
            { "label": "Warm-up",   "detail": "400m easy FR · 30s rest" },
            { "label": "Pre-set",   "detail": "4×50m kick on 2:00" },
            { "label": "Main set",  "detail": "8×100m @ CSS on 1:40" },
            { "label": "Cool-down", "detail": "200m easy choice" }
          ]
        }
      ]
    }
  ]
}

Rules:
- Include exactly ${weeksToGenerate} weeks, numbered ${startWeek}–${totalWeeks}.
- Sessions must only fall on the swimmer's stated swim days.
- Each session must include "category": one of "Base", "Build", or "Sharpen":
  - "Base": aerobic base building, recovery, and technique-focused sessions
  - "Build": threshold, endurance, stroke-specific, kick/pull, and drill sessions
  - "Sharpen": speed, anaerobic capacity, and race-pace sessions
- Use proper swimming notation: e.g. "6×100m @ CSS on 1:45" or "4×50m kick on 2:00".
- Interval sets (reps): use turnaround notation "on M:SS" (e.g. "8×100m @ CSS on 1:40").
- Non-interval segments (Warm-up, Cool-down, standalone distances): MUST include a rest interval using "· Xs rest" for < 60 s (e.g. "400m easy FR · 30s rest") or "· M:SS rest" for ≥ 60 s. Use 10–20 s for drills, 20–30 s for easy, 30–60 s for moderate. Omit rest on the final Cool-down segment.
- Keep each "detail" string under 65 characters.
- Progress volume and intensity; weeks 4, 8, and 12 are recovery weeks if they fall in this range.
- Always include Warm-up and Cool-down sets.
- Scale distances to fit within the stated session length.`;

  const client = new Anthropic({
    apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true,
    timeout: 180000,
  });

  const stream = client.messages.stream({
    model: 'claude-sonnet-4-6',
    max_tokens: 16000,
    system: [{ type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Generate weeks ${startWeek}–${totalWeeks} of a 12-week swimming plan for:\n\n${formatProfileText(meta)}`,
    }],
  });

  const message = await stream.finalMessage();
  const raw     = message.content[0]?.text ?? '';
  const jsonStr = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(jsonStr);
  if (Array.isArray(parsed.weeks)) return parsed.weeks;
  const nested = Object.values(parsed).find((v) => v && Array.isArray(v.weeks));
  return nested ? nested.weeks : [];
}
