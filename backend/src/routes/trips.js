const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const authGuard = require('../middleware/authGuard');
const { geocodeLocation, findNearbyPlaces } = require('../services/maps');
const { rankPlacesForTripType } = require('../services/scoring');
const { generateTripPlan, interpretVoiceCommand } = require('../services/gemini');

// CREATE TRIP
router.post('/', authGuard, async (req, res) => {
  try {
    const {
      trip_name,
      start_location, start_lat, start_lng,
      end_location, end_lat, end_lng,
      start_date, start_time,
      trip_type, vehicle_type, member_count, trip_days,
      planning_mode, custom_places
    } = req.body;

    if (!trip_name || !start_location || !end_location || !start_date || !start_time || !trip_type || !vehicle_type) {
      return res.status(400).json({ error: 'All fields required' });
    }

    const result = await pool.query(
      `INSERT INTO trips (
        user_id, trip_name,
        start_location, start_lat, start_lng,
        end_location, end_lat, end_lng,
        start_date, start_time,
        trip_type, vehicle_type, member_count, trip_days,
        planning_mode, custom_places
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
      RETURNING *`,
      [
        req.userId, trip_name,
        start_location, start_lat, start_lng,
        end_location, end_lat, end_lng,
        start_date, start_time,
        trip_type, vehicle_type, member_count || 1, trip_days || 1,
        planning_mode || 'sightseeing', custom_places || null
      ]
    );

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET ALL TRIPS FOR USER
router.get('/', authGuard, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trips WHERE user_id = $1 ORDER BY created_at DESC',
      [req.userId]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET SINGLE TRIP
router.get('/:id', authGuard, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM trips WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GENERATE TRIP PLAN
router.post('/:id/plan', authGuard, async (req, res) => {
  try {
    const tripResult = await pool.query(
      'SELECT * FROM trips WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const trip = tripResult.rows[0];

    // Clear existing stops before regenerating
    await pool.query('DELETE FROM trip_stops WHERE trip_id = $1', [trip.id]);

    // Generate plan with Gemini
    const stops = await generateTripPlan(trip);

    // Save stops to DB with real nearby places
    const savedStops = [];
    for (const stop of stops) {
      let coords = null;
      try {
        coords = await geocodeLocation(stop.search_location || stop.location_description);
      } catch (geoErr) {
        console.error(`[stop ${stop.sequence}] geocode failed:`, geoErr.message);
      }

      let nearbyPlaces = [];
      if (coords) {
        try {
          const rawPlaces = await findNearbyPlaces(coords.lat, coords.lng, stop.place_type);
          nearbyPlaces = rankPlacesForTripType(rawPlaces, trip.trip_type, stop.stop_type);

          for (const place of nearbyPlaces.slice(0, 3)) {
            await pool.query(
              `INSERT INTO places (name, lat, lng, place_type, our_score, price_category)
               VALUES ($1, $2, $3, $4, $5, $6)
               ON CONFLICT DO NOTHING`,
              [place.name, place.lat, place.lng, place.amenity, place.our_score, place.price_category]
            );
          }
        } catch (placesErr) {
          console.error(`[stop ${stop.sequence}] nearby places error:`, placesErr.message);
          // non-fatal — continue without nearby places
        }
      }

      try {
        const result = await pool.query(
          `INSERT INTO trip_stops
            (trip_id, stop_type, suggested_time, sequence_order, notes, day_number, stop_lat, stop_lng)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING *`,
          [
            trip.id,
            stop.stop_type,
            stop.suggested_time || null,
            stop.sequence,
            `${stop.place_name || stop.location_description} | ${stop.notes} | Category: ${stop.price_category}`,
            stop.day || 1,
            coords?.lat || null,
            coords?.lng || null,
          ]
        );

        savedStops.push({
          ...result.rows[0],
          nearby_places: nearbyPlaces.slice(0, 3),
          coords
        });
      } catch (insertErr) {
        console.error(`[stop ${stop.sequence}] INSERT failed:`, insertErr.message, insertErr.detail || '');
        throw insertErr;
      }
    }

    await pool.query(
      "UPDATE trips SET status = 'planned' WHERE id = $1",
      [trip.id]
    );

    res.json({
      trip,
      stops: savedStops,
      raw_plan: stops
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to generate plan: ' + err.message });
  }
});

// GET TRIP STOPS
router.get('/:id/stops', authGuard, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM trip_stops WHERE trip_id = $1 ORDER BY sequence_order ASC`,
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE TRIP
router.delete('/:id', authGuard, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM trips WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    res.json({ message: 'Trip deleted successfully' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// SUBMIT REVIEW FOR A STOP
router.post('/:tripId/stops/:stopId/review', authGuard, async (req, res) => {
  try {
    const { rating, cleanliness_rating, food_quality, comment } = req.body;
    const { tripId, stopId } = req.params;

    // Get the stop to find place_id
    const stopResult = await pool.query(
      'SELECT * FROM trip_stops WHERE id = $1 AND trip_id = $2',
      [stopId, tripId]
    );

    if (stopResult.rows.length === 0) {
      return res.status(404).json({ error: 'Stop not found' });
    }

    // Get trip type
    const tripResult = await pool.query(
      'SELECT trip_type FROM trips WHERE id = $1',
      [tripId]
    );

    const trip_type = tripResult.rows[0]?.trip_type;

    // Save review with place_id if available
    const place_id = stopResult.rows[0]?.place_id || null;

    const result = await pool.query(
      `INSERT INTO reviews 
        (user_id, trip_id, place_id, rating, cleanliness_rating, food_quality, comment, trip_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [req.userId, tripId, place_id, rating, cleanliness_rating, food_quality, comment, trip_type]
    );

    // Update place score if place_id exists
    if (place_id) {
      await pool.query(
        `UPDATE places SET 
          our_score = (our_score * total_reviews + $1) / (total_reviews + 1),
          total_reviews = total_reviews + 1
         WHERE id = $2`,
        [rating, place_id]
      );
    }

    res.status(201).json(result.rows[0]);

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});



// UPDATE STOP BY TYPE — direct DB update for clarified multi-day voice commands, no Gemini call
router.post('/:id/stops/update-by-type', authGuard, async (req, res) => {
  try {
    const { stop_type, day_number, new_time } = req.body;
    const tripId = req.params.id;

    if (!stop_type || !day_number || !new_time) {
      return res.status(400).json({ error: 'stop_type, day_number, new_time required' });
    }

    const tripResult = await pool.query(
      'SELECT id FROM trips WHERE id = $1 AND user_id = $2',
      [tripId, req.userId]
    );
    if (tripResult.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });

    console.log(`[update-by-type] tripId=${tripId} stop_type=${stop_type} day=${day_number} new_time=${new_time}`);

    const result = await pool.query(
      `UPDATE trip_stops SET suggested_time = $1
       WHERE trip_id = $2 AND stop_type = $3 AND day_number = $4
       RETURNING *`,
      [new_time, tripId, stop_type, parseInt(day_number, 10)]
    );

    if (result.rows.length === 0) {
      console.warn(`[update-by-type] no match for stop_type=${stop_type} day=${day_number}`);
      return res.json({ success: false, message: `No ${stop_type} stop found on day ${day_number}` });
    }

    console.log(`[update-by-type] updated stopId=${result.rows[0].id}`);
    res.json({ success: true, updated_stop: result.rows[0] });
  } catch (err) {
    console.error('[update-by-type] error:', err.message);
    res.status(500).json({ error: 'Server error' });
  }
});
// QUICK REVIEW — in-trip proximity review (only overall rating, marks stop as visited)
router.post('/:id/stops/:stopId/quick-review', authGuard, async (req, res) => {
  try {
    const { rating } = req.body;
    const { id: tripId, stopId } = req.params;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ error: 'rating 1-5 required' });
    }

    const stopResult = await pool.query(
      'SELECT * FROM trip_stops WHERE id = $1 AND trip_id = $2',
      [stopId, tripId]
    );
    if (stopResult.rows.length === 0) return res.status(404).json({ error: 'Stop not found' });

    const tripResult = await pool.query('SELECT trip_type FROM trips WHERE id = $1', [tripId]);
    const trip_type = tripResult.rows[0]?.trip_type;
    const place_id = stopResult.rows[0]?.place_id || null;

    await pool.query(
      `INSERT INTO reviews (user_id, trip_id, place_id, rating, cleanliness_rating, food_quality, comment, trip_type)
       VALUES ($1, $2, $3, $4, 3, 3, '', $5)`,
      [req.userId, tripId, place_id, rating, trip_type]
    );

    await pool.query(
      `UPDATE trip_stops SET proximity_review_done = TRUE, visited_at = NOW() WHERE id = $1`,
      [stopId]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Quick review error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PROXIMITY VISITED — mark stop as seen (user skipped the quick review)
router.patch('/:id/stops/:stopId/proximity-visited', authGuard, async (req, res) => {
  try {
    const { id: tripId, stopId } = req.params;
    await pool.query(
      `UPDATE trip_stops SET proximity_review_done = TRUE, visited_at = NOW()
       WHERE id = $1 AND trip_id = $2`,
      [stopId, tripId]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Proximity visited error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});
// VOICE COMMAND — modify a stop by voice
router.post('/:id/voice-command', authGuard, async (req, res) => {
  const { command, current_lat, current_lng, current_time, avg_speed_kmh } = req.body;
  console.log(`[voice] ▶ tripId=${req.params.id} command="${command}" loc=${current_lat ? `${current_lat},${current_lng} @${current_time}` : 'none'}`);

  try {
    if (!command) return res.status(400).json({ error: 'command text required' });

    // Build location context if GPS was sent from mobile
    const locationCtx = (current_lat && current_lng && current_time)
      ? {
          current_lat: parseFloat(current_lat),
          current_lng: parseFloat(current_lng),
          current_time,
          avg_speed_kmh: parseFloat(avg_speed_kmh) || 60,
        }
      : null;

    console.log('[voice] step=fetch-trip');
    const tripResult = await pool.query(
      'SELECT * FROM trips WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (tripResult.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });

    const trip = tripResult.rows[0];
    console.log(`[voice] step=fetch-stops trip="${trip.trip_name}"`);
    const stopsResult = await pool.query(
      'SELECT * FROM trip_stops WHERE trip_id = $1 ORDER BY sequence_order ASC',
      [trip.id]
    );
    console.log(`[voice] step=interpret stops=${stopsResult.rows.length}`);

    const action = await interpretVoiceCommand(command, trip, stopsResult.rows, locationCtx);
    console.log(`[voice] step=action action=${JSON.stringify(action)}`);

    if (action.action === 'ask_day') {
      const question = `Which day would you like to change the ${action.stop_type} stop? This trip has ${trip.trip_days} days.`;
      console.log(`[voice] step=ask_day stopType=${action.stop_type} pending=${JSON.stringify(action.pending_change)}`);
      return res.json({
        success: true,
        needs_clarification: true,
        question,
        pending_action: { stop_type: action.stop_type, ...action.pending_change },
        understood_command: action.understood_command,
      });
    }

    if (action.action === 'unknown') {
      return res.json({
        success: false,
        understood_command: action.understood_command,
        message: action.message || 'Could not understand the command',
      });
    }

    let updatedStop = null;

    if (action.action === 'update_time') {
      let query, params;
      if (action.location_aware && action.new_place_name) {
        // Location-aware: update time AND place in a single query
        const newNotes = `${action.new_place_name} | Near your route at ${action.new_time} | Category: ${action.new_price_category || 'budget'}`;
        console.log(`[voice] step=db-update-time+place seq=${action.stop_sequence} time=${action.new_time} place="${action.new_place_name}"`);
        query = `UPDATE trip_stops SET suggested_time = $1, notes = $2, stop_lat = $3, stop_lng = $4
                 WHERE trip_id = $5 AND sequence_order = $6 RETURNING *`;
        params = [action.new_time, newNotes, action.new_place_lat, action.new_place_lng, trip.id, action.stop_sequence];
      } else {
        console.log(`[voice] step=db-update-time seq=${action.stop_sequence} time=${action.new_time}`);
        query = `UPDATE trip_stops SET suggested_time = $1
                 WHERE trip_id = $2 AND sequence_order = $3 RETURNING *`;
        params = [action.new_time, trip.id, action.stop_sequence];
      }
      const result = await pool.query(query, params);
      updatedStop = result.rows[0] || null;
      console.log(`[voice] step=db-done updatedStop=${updatedStop?.id || 'null'}`);
    }

    if (action.action === 'change_place') {
      console.log(`[voice] step=geocode place="${action.new_place_name}"`);
      let lat = null, lng = null;
      try {
        const coords = await geocodeLocation(action.new_place_name);
        lat = coords?.lat || null;
        lng = coords?.lng || null;
        console.log(`[voice] step=geocode-ok lat=${lat} lng=${lng}`);
      } catch (geoErr) {
        console.error('[voice] geocode failed (non-fatal):', geoErr.message);
      }

      const newNotes = `${action.new_place_name} | ${action.new_notes || ''} | Category: ${action.new_price_category || 'budget'}`;
      console.log(`[voice] step=db-update-place seq=${action.stop_sequence}`);
      const result = await pool.query(
        `UPDATE trip_stops SET notes = $1, stop_lat = $2, stop_lng = $3
         WHERE trip_id = $4 AND sequence_order = $5 RETURNING *`,
        [newNotes, lat, lng, trip.id, action.stop_sequence]
      );
      updatedStop = result.rows[0] || null;
      console.log(`[voice] step=db-done updatedStop=${updatedStop?.id || 'null'}`);
    }

    console.log(`[voice] ✓ success`);
    res.json({ success: true, understood_command: action.understood_command, action, updated_stop: updatedStop });

  } catch (err) {
    console.error('[voice] ✗ FAILED:', err.message);
    console.error('[voice] stack:', err.stack);
    res.status(500).json({ error: 'Failed to process voice command: ' + err.message });
  }
});

// MARK TRIP AS COMPLETED
router.patch('/:id/complete', authGuard, async (req, res) => {
  try {
    const result = await pool.query(
      "UPDATE trips SET status = 'completed' WHERE id = $1 AND user_id = $2 RETURNING *",
      [req.params.id, req.userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;