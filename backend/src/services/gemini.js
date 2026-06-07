const { GoogleGenerativeAI } = require('@google/generative-ai');

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

async function generateTripPlan(tripData) {
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const {
    start_location,
    end_location,
    start_time,
    start_date,
    trip_type,
    vehicle_type,
    member_count
  } = tripData;

  const prompt = `You are Payanam, an expert Indian travel planner for South India road trips.
Plan a road trip:
From: ${start_location}
To: ${end_location}
Date: ${start_date}
Start Time: ${start_time}
Trip Type: ${trip_type}
Vehicle: ${vehicle_type}
Members: ${member_count}

Return ONLY a valid JSON array, no markdown, no extra text.
Each stop must have a "search_location" field with a simple searchable town or area name only (e.g. "Mettupalayam" not a long description):
[{
  "sequence": 1,
  "stop_type": "tea",
  "suggested_time": "07:00",
  "location_description": "brief description",
  "search_location": "Mettupalayam",
  "place_type": "cafe",
  "price_category": "budget",
  "notes": "short note"
}]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json|```/g, '').trim();

  try {
    return JSON.parse(cleaned);
  } catch (parseErr) {
    console.error('Gemini response was not valid JSON:', cleaned.slice(0, 200));
    throw new Error('Gemini returned invalid response. Please try again.');
  }
}

module.exports = { generateTripPlan };