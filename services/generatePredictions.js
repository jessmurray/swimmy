import Anthropic from '@anthropic-ai/sdk';

const LEVELS         = ['Casual', 'Fitness', 'Club', 'Competitive', 'Former competitive'];
const GOALS          = [
  'Improve general fitness',
  'Cross-train or complement another sport',
  'Get back into swimming after a break',
  'Get faster at a stroke or distance',
  'Train for an event, gala or competition',
  'Train for a triathlon',
];
const TRAINING_DAYS   = ['1–2 days per week', '3–4 days per week', '5–7 days per week'];
const SESSION_LENGTHS = ['15 min', '30 min', '45 min', '60 min', '90 min', '120+ min'];
const STROKE_LABELS   = {
  freestyle: 'Freestyle', backstroke: 'Backstroke', breaststroke: 'Breaststroke',
  butterfly: 'Butterfly', im: 'IM',
};

const SYSTEM = `You are an expert swimming coach giving honest, motivating time predictions after a 12-week training plan. Predictions should feel achievable and credible to serious swimmers.

Return ONLY valid JSON — no markdown fences, no explanation.

Structure:
{
  "predictions": {
    "<stroke_id>": {
      "<distance>": { "time": "<formatted>", "improvement": <number> }
    }
  }
}

Rules:
- stroke_id values: freestyle, backstroke, breaststroke, butterfly, im
- "time": M:SS.ss for ≥ 60 s, SS.ss for < 60 s
- "improvement": % improvement vs current PB, positive, 2 decimal places.
  Set to 0 if no current PB was provided — do not invent a baseline to calculate from.
- Only include the events listed in the request.

Improvement bands over 12 weeks:

  Former competitive swimmer:
    1–2 days/week or cross-training goal:  1–2%
    3–4 days/week:                         1.5–2.5%
    5+ days/week or event-focused goal:    2–3%

  Fitness or Casual swimmer:
    Any frequency:                         4–6%

  Club swimmer:
    Any frequency:                         2–4%

  Competitive swimmer:
    Any frequency:                         2–4%

Calibration example: a former competitive swimmer doing 1:26.00 for 100m breaststroke at 3×/week should target around 1:24.00–1:25.00 (roughly 1–2% improvement).

Additional adjustments:
  - Goal is "cross-train" or "general fitness": use lower half of band
  - Goal is "get faster" or "train for event/triathlon": use upper half of band
  - Session length ≤ 30 min: shift toward lower end
  - Training days 1–2/week: shift toward lower end`;

export async function generatePredictions(meta) {
  const { events, event_times, level, goal, training_days, session_length } = meta ?? {};

  const client = new Anthropic({
    apiKey: process.env.EXPO_PUBLIC_ANTHROPIC_API_KEY,
    dangerouslyAllowBrowser: true,
    timeout: 60_000,
  });

  const eventLines = Object.entries(events ?? {}).flatMap(([strokeId, dists]) =>
    dists.map((dist) => {
      const pb = event_times?.[strokeId]?.[dist]?.trim();
      return `- ${STROKE_LABELS[strokeId] ?? strokeId} ${dist}: ${pb || 'no PB'}`;
    })
  );

  const prompt = [
    `Level: ${LEVELS[level] ?? 'not specified'}`,
    `Goal: ${GOALS[goal] ?? 'not specified'}`,
    `Training: ${TRAINING_DAYS[training_days] ?? 'not specified'}`,
    `Session length: ${SESSION_LENGTHS[session_length] ?? 'not specified'}`,
    '',
    'Events and current PBs:',
    ...eventLines,
  ].join('\n');

  const response = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 1024,
    system: SYSTEM,
    messages: [{ role: 'user', content: `Predict times for:\n\n${prompt}` }],
  });

  const raw = response.content[0]?.text ?? '';

  const jsonStr = raw
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();

  const parsed = JSON.parse(jsonStr);
  return parsed.predictions ?? parsed;
}
