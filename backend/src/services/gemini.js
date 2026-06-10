const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateTripPlan(tripData) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const {
    start_location,
    end_location,
    start_time,
    trip_type,
    vehicle_type,
    member_count,
    trip_days,
    planning_mode = 'sightseeing',
    custom_places,
  } = tripData;

  const days = parseInt(trip_days) || 1;
  let allStops = [];
  let sequenceCounter = 1;

  for (let day = 1; day <= days; day++) {
    const isFirstDay = day === 1;
    const isLastDay = day === days;

    const dayContext = isFirstDay
      ? `Travel day: drive from ${start_location} to ${end_location}`
      : isLastDay
      ? `Last day: explore ${end_location} and return to ${start_location}`
      : `Middle day: full day exploring ${end_location} and nearby areas`;

    const tripTypeGuide =
      trip_type === 'boys' || trip_type === 'bachelor'
        ? 'dhabas, local street food stalls, adventure spots, viewpoints with local chai'
        : trip_type === 'family'
        ? 'clean A/C restaurants, kid-friendly attractions, famous temples, scenic parks'
        : trip_type === 'friends'
        ? 'popular local eateries, famous viewpoints, cafes, waterfalls, adventure spots'
        : 'well-known restaurants, iconic landmarks, comfortable stays';

    const stopsInstruction = buildStopsInstruction(
      planning_mode, custom_places, isLastDay, days
    );

    const prompt = `You are Payanam, an expert South India road trip planner with deep local knowledge.
Plan Day ${day} of a ${days}-day ${trip_type} trip.
Route context: ${dayContext}
Start Time: ${isFirstDay ? start_time : '07:00'}
Vehicle: ${vehicle_type} | Members: ${member_count}
Trip style: ${tripTypeGuide}

${stopsInstruction}

CRITICAL RULE: Use REAL, SPECIFIC place names that actually exist in South India.
- BAD: "a good restaurant near the highway", "local tea stall", "popular viewpoint"
- GOOD: "A2B Adyar Ananda Bhavan, Tindivanam", "Hotel Junior Kuppanna, Erode", "Doddabetta Peak, Ooty"
- place_name = exact real establishment or attraction name
- search_location = city or town only (used for geocoding, one word or short phrase)

Return ONLY a valid JSON array, no markdown, no explanation:
[{
  "day": ${day},
  "sequence": 1,
  "stop_type": "tea",
  "suggested_time": "07:00",
  "place_name": "Exact real place name, City",
  "location_description": "Exact real place name, City",
  "search_location": "city name only",
  "place_type": "cafe",
  "price_category": "budget",
  "notes": "one line tip for travellers"
}]`;

    const result = await generateWithRetry(model, prompt);
    const text = result.response.text();
    const cleaned = text.replace(/```json|```/g, '').trim();

    console.log(`\n=== GEMINI RAW RESPONSE (Day ${day}, mode: ${planning_mode}) ===\n${cleaned}\n=== END ===\n`);

    try {
      const dayStops = JSON.parse(cleaned);
      const fixedStops = dayStops.map(stop => ({
        ...stop,
        day: day,
        sequence: sequenceCounter++,
      }));
      allStops = [...allStops, ...fixedStops];
    } catch (parseErr) {
      console.error(`Day ${day} parse error:`, cleaned.slice(0, 200));
      throw new Error(`Failed to generate plan for day ${day}. Please try again.`);
    }
  }

  return allStops;
}

const FALLBACK_MODELS = ['gemini-2.5-flash', 'gemini-2.0-flash', 'gemini-1.5-flash'];

async function generateWithRetry(model, prompt, retries = 2, delayMs = 5000) {
  let modelIndex = 0;
  let currentModel = model;

  for (let attempt = 1; attempt <= retries + FALLBACK_MODELS.length; attempt++) {
    try {
      return await currentModel.generateContent(prompt);
    } catch (err) {
      const is503 = err.status === 503 || err.message?.includes('503');
      if (!is503) throw err;

      // After initial retries, try next fallback model
      if (attempt > retries && modelIndex < FALLBACK_MODELS.length - 1) {
        modelIndex++;
        const nextModelName = FALLBACK_MODELS[modelIndex];
        console.log(`Gemini 503 — switching to ${nextModelName}...`);
        currentModel = genAI.getGenerativeModel({ model: nextModelName });
        delayMs = 3000;
      } else if (attempt <= retries) {
        console.log(`Gemini 503 — retry ${attempt}/${retries} in ${delayMs / 1000}s...`);
      } else {
        throw err;
      }
      await new Promise(r => setTimeout(r, delayMs));
      delayMs = Math.min(delayMs * 1.5, 15000);
    }
  }
}

function buildStopsInstruction(planning_mode, custom_places, isLastDay, totalDays) {
  if (planning_mode === 'essential') {
    const needsStay = !isLastDay && totalDays > 1;
    const stopList = needsStay
      ? 'tea, breakfast, lunch, snack, dinner, stay/accommodation'
      : 'tea, breakfast, lunch, snack, dinner';
    const count = needsStay ? 6 : 5;
    return `Planning Mode: ESSENTIAL — meals and refreshments only.
Generate EXACTLY ${count} stops in this order: ${stopList}.
NO sightseeing, viewpoints, temples, museums, or activity stops.
Only use real restaurants, dhabas, cafes, and eateries along the route.`;
  }

  if (planning_mode === 'customized') {
    const placeLines = (custom_places || '')
      .split('\n')
      .map(p => p.trim())
      .filter(p => p);
    const needsStay = !isLastDay && totalDays > 1;

    if (placeLines.length === 0) {
      // Fallback to sightseeing if no places entered
      return buildStopsInstruction('sightseeing', null, isLastDay, totalDays);
    }

    const totalStops = placeLines.length + 4 + (needsStay ? 1 : 0);
    const placesList = placeLines.map((p, i) => `${i + 1}. ${p}`).join('\n');
    const mealsList = needsStay
      ? 'tea, breakfast, lunch, dinner, stay'
      : 'tea, breakfast, lunch, dinner';

    return `Planning Mode: CUSTOMIZED — plan meals around the user's chosen places.
The user specifically wants to visit these places (MANDATORY — include ALL as stops):
${placesList}

Use stop_type "sightseeing" for each of the above places.
Fill remaining stops with: ${mealsList} at times that fit logically around the custom places.
Generate EXACTLY ${totalStops} stops total.`;
  }

  // sightseeing (default)
  return `Planning Mode: SIGHTSEEING — meals + popular real attractions.
Generate EXACTLY 7 stops. Must include: tea, breakfast, sightseeing, lunch, sightseeing, dinner, stay/accommodation.
For sightseeing stops: use well-known real attraction names relevant to the route.`;
}

async function interpretVoiceCommand(commandText, trip, stops) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const stopsContext = stops.map(s => {
    const location = s.notes?.split('|')[0]?.trim() || s.stop_type;
    return `seq=${s.sequence_order} type=${s.stop_type} time=${s.suggested_time?.slice(0, 5) || '?'} place="${location}"`;
  }).join('\n');

  const prompt = `You are a trip assistant for a ${trip.trip_type} road trip from ${trip.start_location} to ${trip.end_location}.

Current stops:
${stopsContext}

Voice command from user: "${commandText}"

Interpret this command and reply ONLY with one JSON object — no markdown, no explanation:

Update time: {"understood_command":"...","action":"update_time","stop_sequence":N,"new_time":"HH:MM"}
Change place: {"understood_command":"...","action":"change_place","stop_sequence":N,"stop_type":"...","new_place_name":"Real South India place, City","new_notes":"brief tip","new_price_category":"budget|mid-range|luxury|free"}
Unknown: {"understood_command":"...","action":"unknown","message":"Could not understand"}

Rules:
- stop_sequence must be one of the seq= numbers listed above
- new_place_name must be a real, specific South India establishment (e.g. "Murugan Idli Shop, Salem" not "a restaurant")
- If the stop type is clear but no specific place was named, suggest a real appropriate one along the route`;

  let result;
  try {
    result = await generateWithRetry(model, prompt);
  } catch (apiErr) {
    console.error('[voice] Gemini API call failed:', apiErr.message, apiErr.status || '');
    throw apiErr;
  }

  let rawText;
  try {
    rawText = result.response.text();
  } catch (textErr) {
    console.error('[voice] response.text() failed. promptFeedback:', JSON.stringify(result.response?.promptFeedback));
    throw textErr;
  }

  console.log(`[voice] cmd="${commandText}" → Gemini: ${rawText?.slice(0, 300)}`);

  const jsonMatch = rawText?.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error(`Gemini response has no JSON. Got: ${rawText?.slice(0, 200)}`);

  try {
    return JSON.parse(jsonMatch[0]);
  } catch (parseErr) {
    console.error('[voice] JSON.parse failed on:', jsonMatch[0]?.slice(0, 200));
    throw parseErr;
  }
}

module.exports = { generateTripPlan, interpretVoiceCommand };
