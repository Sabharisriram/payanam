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

// VOICE COMMAND — modify a stop by voice
router.post('/:id/voice-command', authGuard, async (req, res) => {
  try {
    const { command } = req.body;
    if (!command) return res.status(400).json({ error: 'command text required' });

    const tripResult = await pool.query(
      'SELECT * FROM trips WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );
    if (tripResult.rows.length === 0) return res.status(404).json({ error: 'Trip not found' });

    const trip = tripResult.rows[0];
    const stopsResult = await pool.query(
      'SELECT * FROM trip_stops WHERE trip_id = $1 ORDER BY sequence_order ASC',
      [trip.id]
    );

    const action = await interpretVoiceCommand(command, trip, stopsResult.rows);

    if (action.action === 'unknown') {
      return res.json({
        success: false,
        understood_command: action.understood_command,
        message: action.message || 'Could not understand the command',
      });
    }

    let updatedStop = null;

    if (action.action === 'update_time') {
      const result = await pool.query(
        `UPDATE trip_stops SET suggested_time = $1
         WHERE trip_id = $2 AND sequence_order = $3 RETURNING *`,
        [action.new_time, trip.id, action.stop_sequence]
      );
      updatedStop = result.rows[0] || null;
    }

    if (action.action === 'change_place') {
      let lat = null, lng = null;
      try {
        const coords = await geocodeLocation(action.new_place_name);
        lat = coords?.lat || null;
        lng = coords?.lng || null;
      } catch (_) {}

      const newNotes = `${action.new_place_name} | ${action.new_notes || ''} | Category: ${action.new_price_category || 'budget'}`;
      const result = await pool.query(
        `UPDATE trip_stops SET notes = $1, stop_lat = $2, stop_lng = $3
         WHERE trip_id = $4 AND sequence_order = $5 RETURNING *`,
        [newNotes, lat, lng, trip.id, action.stop_sequence]
      );
      updatedStop = result.rows[0] || null;
    }

    res.json({ success: true, understood_command: action.understood_command, action, updated_stop: updatedStop });

  } catch (err) {
    console.error('Voice command error:', err);
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