# Payanam Project Status
## Project
Travel navigation app - React Native + React Web + Node.js + Supabase
## GitHub
https://github.com/Sabharisriram/payanam
## Local Path
D:\payanam
## Tech Stack
- Backend: Node.js + Express, port 5000
- Database: Supabase PostgreSQL (Mumbai ap-south-1)
- Mobile: React Native Expo SDK 54
- Web: React + Vite
- AI: Gemini 2.5 Flash
- Maps: OpenStreetMap + Nominatim
- Realtime: Socket.io
## Completed
- Auth (login/register/JWT)
- Trip creation with trip_days field
- Gemini AI trip planning (per-day generation, 7 stops per day)
- Real nearby places (OSM)
- Mobile app (Android, Expo Go tested)
- Web app (localhost:5173)
- Delete trip
- Live GPS tracker (Socket.io)
- Post-trip reviews with star ratings
- Multi-day trip planning (day_number grouping)
- Exact real South India place names via updated Gemini prompt (trip-type-aware)
- Trip planning modes: essential / sightseeing / customized
- Auto-migration system in db.js (runs on every server start, idempotent)
- Gemini 503 fallback chain: 2.5-flash → 2.0-flash → 1.5-flash
- In-app map (Leaflet + WebView): route line, numbered pins, popup, Google Maps deep link
- Voice command: WebView speech recognition → Gemini 2.5-flash interprets text → stop updated in DB + UI
## Pending Features (Build Order)
### Priority 1 - This Week ✅ COMPLETE
1. ✅ Fix exact place names
   - Rewrote Gemini prompt with CRITICAL RULE: real South India place names only
   - BAD/GOOD examples in prompt ("a good restaurant" vs "Hotel Junior Kuppanna, Erode")
   - Trip-type-aware suggestions: boys/bachelor → dhabas; family → A/C restaurants; friends → cafes/waterfalls
   - Added place_name field to Gemini JSON schema (alongside location_description)
   - backend/src/routes/trips.js uses place_name || location_description in notes
   - search_location (city only) still used for geocoding — unaffected
   - Tested: Chennai→Coimbatore family trip returned A2B, Junior Kuppanna, Le Méridien etc.
2. ✅ Trip planning modes (planning_mode + custom_places)
   - Three modes: essential (5 stops) / sightseeing (7 stops) / customized (N+4 stops)
     - essential: tea, breakfast, lunch, snack, dinner — no sightseeing ever
     - sightseeing: meals + 2 named real attractions + stay (default, existing behaviour)
     - customized: user's places become mandatory sightseeing stops; meals planned around them
   - DB columns added: planning_mode TEXT DEFAULT 'sightseeing', custom_places TEXT
   - Auto-migration in db.js (ALTER TABLE IF NOT EXISTS) — safe on every restart
   - gemini.js: buildStopsInstruction() branches prompt per mode; customized parses custom_places newline list
   - Fallback model chain on Gemini 503: 2.5-flash → 2.0-flash → 1.5-flash (generateWithRetry)
   - UI: mode selector chips + description line added to PlanTripScreen.js (mobile) and PlanTripPage.jsx (web)
   - Customized mode shows "Your Places" textarea only when selected
   - All three modes tested end-to-end: essential=5 stops, sightseeing=7 stops, customized=6 stops with user places preserved
### Priority 2 - Next Week ✅ COMPLETE
3. In-app map with route (Leaflet.js + react-native-webview + OSM, free)
   - MapScreen.js: WebView renders Leaflet.js map with OSM tiles
   - Route line drawn via OSRM free routing API (router.project-osrm.org)
   - Numbered orange pins (1,2,3…) for each stop
   - Tap pin → popup shows stop type, real place name, time, "Navigate Here" button
   - "Navigate Here" sends postMessage → React Native opens Google Maps to that stop
   - "Open Full Route in Google Maps" bottom button builds full directions URL with waypoints
   - Empty state if no coords (instructs user to regenerate plan)
   - DB: stop_lat FLOAT + stop_lng FLOAT added to trip_stops (auto-migrated)
   - Backend: trips.js saves coords?.lat/lng to stop_lat/stop_lng on plan generation
   - TripPlanScreen: "▶ Live Trip" + "🗺️ View Map" side-by-side buttons; normalises stop_lat from coords for fresh plans
   - AppNavigator: MapScreen added to stack
   - Package: react-native-webview installed (expo install, SDK 54 compatible)
### Priority 3 ✅ COMPLETE
4. Voice interaction
   - Approach: hidden WebView (react-native-webview, already installed) runs webkitSpeechRecognition
   - Works in Expo Go — no native build required
   - Press-hold button → WebView starts listening (en-IN locale)
   - Partial results shown live in button text while listening
   - Release button → recognition stops → final text sent to backend
   - WebView→RN via postMessage; RN→WebView via injectJavaScript
   - Message types: partial | result | end | error | unsupported
   - Android microphone permission: RECORD_AUDIO in app.json + onPermissionRequest grants it to WebView
   - Backend: POST /trips/:id/voice-command accepts { command: text } (no audio, no base64)
   - gemini.js interpretVoiceCommand(commandText, trip, stops): plain text prompt to gemini-2.5-flash
   - Uses generateWithRetry (same 503 fallback chain as trip planner: 2.5→2.0→1.5-flash)
   - Granular error logging: API call / response.text() / JSON.parse each have their own console.error
   - Gemini returns action JSON: update_time | change_place | unknown
   - update_time: UPDATE suggested_time on matching sequence_order in DB
   - change_place: re-geocodes new place name, UPDATE notes + stop_lat/stop_lng
   - Mobile merges updated_stop back into plan state (no full reload)
   - Voice button: purple idle → red listening (shows partial text) → spinner processing → green done / red error
   - Auto-resets to idle after 4 seconds
   - TTS feedback via expo-speech (en-IN): "Listening" on start; natural success message on done; "Sorry, I couldn't understand. Please try again." on all error paths
## Tech Needed for New Features
- react-native-maps (OSM tiles - free)
- Deep link to Google Maps app
## Current Bug Fixed
- trip_days now saves to DB (added $14 to INSERT query)
- Gemini now generates per day separately in a loop
- Web TripPlanPage shows stops grouped by day
## Database
- Supabase project: payanam (jjuaqckfqdexebrswylo)
- Tables: users, trips, trip_stops, places, reviews, trip_locations
- Columns auto-migrated on server start (db.js runMigrations):
  - trips.trip_days INTEGER DEFAULT 1
  - trip_stops.day_number INTEGER DEFAULT 1
  - trips.planning_mode TEXT DEFAULT 'sightseeing'
  - trips.custom_places TEXT
  - trip_stops.stop_lat FLOAT
  - trip_stops.stop_lng FLOAT
## Mobile IP
Changes daily - update BASE_URL in mobile/src/api/client.js
Run ipconfig to get current IPv4
## Client Handover Notes
- Client will deploy on AWS
- They need their own: Supabase, Gemini API key, Google Cloud project
- Provide .env.example and HANDOVER.md

