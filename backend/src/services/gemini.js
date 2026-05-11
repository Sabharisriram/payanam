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

Return ONLY a valid JSON array, no markdown, no extra text:
[{"sequence":1,"stop_type":"tea","suggested_time":"07:00","location_description":"location here","place_type":"tea stall","price_category":"budget","notes":"notes here"}]`;

  const result = await model.generateContent(prompt);
  const text = result.response.text();
  const cleaned = text.replace(/```json|```/g, '').trim();
  return JSON.parse(cleaned);
}

module.exports = { generateTripPlan };