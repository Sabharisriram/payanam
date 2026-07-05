const { GoogleGenerativeAI } = require('@google/generative-ai');
const { findNearbyPlaces } = require('./maps');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Map voice command stop types to Nominatim/Overpass amenity search terms
const STOP_PLACE_TYPE = {
  tea: 'cafe', breakfast: 'restaurant', lunch: 'restaurant',
  dinner: 'restaurant', snack: 'cafe', meal: 'restaurant',
  fuel: 'fuel', accommodation: 'hotel', stay: 'hotel',
  'stay/accommodation': 'hotel', sightseeing: 'viewpoint', viewpoint: 'viewpoint',
};

// Dead-reckoning: project current GPS position forward along bearing toward trip destination
function calcFuturePosition(locCtx, newTimeStr, trip, stops) {
  const { current_lat, current_lng, current_time, avg_speed_kmh = 60 } = locCtx;

  const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  const diffMins = toMins(newTimeStr) - toMins(current_time);
  console.log(`[loc-debug/calc] current_time=${current_time} new_time=${newTimeStr} diffMins=${diffMins} distKm=${(avg_speed_kmh * diffMins / 60).toFixed(1)}`);
  if (diffMins <= 0) {
    console.warn(`[loc-debug/calc] diffMins=${diffMins} ≤ 0, returning null`);
    return null;
  }

  const distKm = avg_speed_kmh * (diffMins / 60);

  // Bearing reference: trip end coords, or last stop with valid coords
  let destLat = trip.end_lat ? parseFloat(trip.end_lat) : null;
  let destLng = trip.end_lng ? parseFloat(trip.end_lng) : null;
  console.log(`[loc-debug/calc] trip end coords: end_lat=${trip.end_lat} end_lng=${trip.end_lng}`);

  if (!destLat || !destLng) {
    const stopsWithCoords = stops.filter(s => s.stop_lat && s.stop_lng);
    console.log(`[loc-debug/calc] no trip end coords — using last stop. stopsWithCoords=${stopsWithCoords.length}`);
    if (stopsWithCoords.length === 0) {
      console.warn(`[loc-debug/calc] no stops with coords — cannot determine bearing, returning null`);
      return null;
    }
    const last = stopsWithCoords[stopsWithCoords.length - 1];
    destLat = parseFloat(last.stop_lat);
    destLng = parseFloat(last.stop_lng);
    console.log(`[loc-debug/calc] bearing dest from last stop: ${destLat},${destLng}`);
  }

  const toRad = d => d * Math.PI / 180;
  const lat1 = toRad(current_lat);
  const lat2 = toRad(destLat);
  const dLon = toRad(destLng - current_lng);

  // Forward azimuth from current pos to destination
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  const brng = Math.atan2(y, x);

  // Project along bearing
  const angDist = distKm / 6371; // Earth radius 6371 km
  const futLatR = Math.asin(
    Math.sin(lat1) * Math.cos(angDist) +
    Math.cos(lat1) * Math.sin(angDist) * Math.cos(brng)
  );
  const futLonR = toRad(current_lng) + Math.atan2(
    Math.sin(brng) * Math.sin(angDist) * Math.cos(lat1),
    Math.cos(angDist) - Math.sin(lat1) * Math.sin(futLatR)
  );

  return { lat: futLatR * 180 / Math.PI, lng: futLonR * 180 / Math.PI };
}

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

async function interpretAgentCommand(commandText, trip, stops, locationCtx = null, conversationHistory = []) {
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

    const stopsContext = stops.map(s => {
      const location = s.notes?.split('|')[0]?.trim() || s.stop_type;
      const skipped = s.proximity_review_done ? ' [SKIPPED]' : '';
      return `seq=${s.sequence_order} day=${s.day_number || 1} type=${s.stop_type} time=${s.suggested_time?.slice(0, 5) || '?'} place="${location}"${skipped}`;
    }).join('\n');

    const locationInfo = locationCtx
      ? `Current GPS: ${locationCtx.current_lat.toFixed(4)}, ${locationCtx.current_lng.toFixed(4)} | Current time: ${locationCtx.current_time} | Speed: ~${locationCtx.avg_speed_kmh} km/h`
      : 'Current location: unknown';

    const historyContext = conversationHistory.length > 0
      ? '\nRECENT CONVERSATION:\n' + conversationHistory.map(h => `${h.role === 'user' ? 'User' : 'Agent'}: ${h.text}`).join('\n')
      : '';

    const tripDays = parseInt(trip.trip_days) || 1;

    console.log(`[agent/gemini] cmd="${commandText}" stops=${stops.length} history=${conversationHistory.length}`);

    const prompt = `You are Payanam, an intelligent AI co-driver for a ${trip.trip_type} road trip.

TRIP: ${trip.start_location} → ${trip.end_location} | ${trip.trip_type} | ${trip.vehicle_type} | ${trip.member_count} member(s) | ${tripDays} day(s)
${locationInfo}

STOPS:
${stopsContext}
${historyContext}

The traveler just said: "${commandText}"

Respond ONLY with one valid JSON object — no markdown, no explanation — using exactly one of these actions:

update_time — change a stop's scheduled time
{"action":"update_time","parameters":{"stop_sequence":N,"day_number":N,"new_time":"HH:MM","stop_type":"..."},"response_text":"spoken confirmation"}

change_place — swap the place for a stop
{"action":"change_place","parameters":{"stop_sequence":N,"day_number":N,"stop_type":"...","new_place_name":"Real South India place, City","new_notes":"brief tip","new_price_category":"budget|mid-range|luxury|free"},"response_text":"spoken confirmation"}

skip_stop — mark a stop as skipped/cancelled
{"action":"skip_stop","parameters":{"stop_sequence":N,"day_number":N,"stop_type":"..."},"response_text":"spoken confirmation"}

add_stop — add a new stop to the plan
{"action":"add_stop","parameters":{"stop_type":"tea|breakfast|lunch|dinner|sightseeing|fuel|accommodation","time":"HH:MM","day_number":N,"place_name":"Real South India place, City","notes":"brief tip"},"response_text":"spoken confirmation"}

find_nearby — find the nearest place of a type at current GPS location
{"action":"find_nearby","parameters":{"place_type":"tea|breakfast|lunch|dinner|fuel|hospital|petrol","add_as_stop":true},"response_text":"spoken response about what you're finding"}

answer_question — answer a question about the trip (no DB change)
{"action":"answer_question","parameters":{},"response_text":"full spoken answer — compute from stops list: remaining count, next stop, ETA estimate, plan summary etc."}

adjust_schedule — push all remaining stops on a day forward or backward
{"action":"adjust_schedule","parameters":{"day_number":N,"direction":"forward|backward","minutes":N},"response_text":"spoken confirmation"}

summarize_plan — read out remaining stops for a day
{"action":"summarize_plan","parameters":{"day_number":N},"response_text":"full spoken summary: list each non-skipped stop with its time and place name"}

ask_day — stop type appears on multiple days and user didn't say which one
{"action":"ask_day","parameters":{"stop_type":"...","pending_change":{"new_time":"HH:MM"}},"response_text":"Which day do you mean? This trip has ${tripDays} days."}

unknown — cannot understand the command
{"action":"unknown","parameters":{},"response_text":"Sorry, I didn't catch that. Could you say it again?"}

RULES:
- stop_sequence must be a seq= value from the STOPS list above
- day_number must match the day= value of that stop
- place names must be real, specific South India establishments ("Murugan Idli Shop, Salem" not "a restaurant")
- response_text must be natural spoken language — warm, concise, like a friendly co-driver
- For answer_question/summarize_plan: derive the answer from the stops data provided
- Day references: "first day"/"day 1"=1, "second day"/"day 2"=2, "last day"=${tripDays}`;

    console.log(`\n=== AGENT PROMPT ===\n${prompt}\n=== END PROMPT ===\n`);

    let result;
    try {
      result = await generateWithRetry(model, prompt);
    } catch (apiErr) {
      console.error('[agent/gemini] API call failed:', apiErr.message, 'status:', apiErr.status || 'n/a');
      throw apiErr;
    }

    let rawText;
    try {
      rawText = result.response.text();
    } catch (textErr) {
      console.error('[agent/gemini] response.text() threw:', textErr.message);
      console.error('[agent/gemini] promptFeedback:', JSON.stringify(result.response?.promptFeedback));
      throw textErr;
    }

    console.log(`[agent/gemini] raw response (${rawText?.length} chars):\n${rawText}`);

    const jsonMatch = rawText?.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[agent/gemini] no JSON found. Full text:', rawText);
      throw new Error(`Gemini response has no JSON. Got: ${rawText?.slice(0, 300)}`);
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
      console.log(`[agent/gemini] parsed OK: action=${parsed.action}`);
    } catch (parseErr) {
      console.error('[agent/gemini] JSON.parse failed on:', jsonMatch[0]);
      throw parseErr;
    }

    if (!parsed.action) {
      console.error(`[agent/gemini] MISSING action field. Full parsed object:`, JSON.stringify(parsed));
      console.error(`[agent/gemini] Full raw Gemini text was:`, rawText);
      parsed.action = 'unknown';
      parsed.response_text = parsed.response_text || "Sorry, I didn't understand that. Could you try again?";
    }

    if (!parsed.parameters) parsed.parameters = {};

    // Location-aware enhancement for update_time: find a real place near the future position
    if (parsed.action === 'update_time' && parsed.parameters.stop_sequence != null && locationCtx) {
      const { stop_sequence, new_time } = parsed.parameters;
      console.log(`[loc-debug] update_time seq=${stop_sequence} new_time=${new_time}`);
      try {
        const futurePos = calcFuturePosition(locationCtx, new_time, trip, stops);
        console.log(`[loc-debug] futurePos:`, JSON.stringify(futurePos));
        if (futurePos) {
          const targetStop = stops.find(s => s.sequence_order === stop_sequence);
          const placeType = STOP_PLACE_TYPE[targetStop?.stop_type] || 'restaurant';
          console.log(`[loc-debug] findNearbyPlaces lat=${futurePos.lat.toFixed(4)} lng=${futurePos.lng.toFixed(4)} type="${placeType}"`);
          const nearby = await findNearbyPlaces(futurePos.lat, futurePos.lng, placeType);
          console.log(`[loc-debug] nearby count=${nearby.length}`);
          if (nearby.length > 0) {
            const best = nearby[0];
            parsed.parameters.location_aware = true;
            parsed.parameters.new_place_name = best.name;
            parsed.parameters.new_place_lat = best.lat;
            parsed.parameters.new_place_lng = best.lng;
            parsed.parameters.new_price_category = best.price_category || 'budget';
            console.log(`[loc-debug] ✓ location_aware place="${best.name}"`);
          } else {
            console.warn(`[loc-debug] no nearby places found for type="${placeType}"`);
          }
        } else {
          const toMins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
          console.warn(`[loc-debug] futurePos=null timeDiff=${toMins(new_time) - toMins(locationCtx.current_time)}mins`);
        }
      } catch (locErr) {
        console.error('[loc-debug] location enhancement failed (non-fatal):', locErr.message);
      }
    }

    return parsed;
  } catch (outerErr) {
    console.error('[agent/gemini] interpretAgentCommand FAILED:', outerErr.message, outerErr.stack);
    throw outerErr;
  }
}

module.exports = { generateTripPlan, interpretAgentCommand };
