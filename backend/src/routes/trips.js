const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const authGuard = require('../middleware/authGuard');
const { geocodeLocation, findNearbyPlaces } = require('../services/maps');
const { rankPlacesForTripType } = require('../services/scoring');

// CREATE TRIP
router.post('/', authGuard, async (req, res) => {
  try {
    const {
      trip_name,
      start_location, start_lat, start_lng,
      end_location, end_lat, end_lng,
      start_date, start_time,
      trip_type, vehicle_type, member_count
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
        trip_type, vehicle_type, member_count
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
      RETURNING *`,
      [
        req.userId, trip_name,
        start_location, start_lat, start_lng,
        end_location, end_lat, end_lng,
        start_date, start_time,
        trip_type, vehicle_type, member_count || 1
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

const { generateTripPlan } = require('../services/gemini');

// GENERATE TRIP PLAN
router.post('/:id/plan', authGuard, async (req, res) => {
  try {
    // Get trip details
    const tripResult = await pool.query(
      'SELECT * FROM trips WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    );

    if (tripResult.rows.length === 0) {
      return res.status(404).json({ error: 'Trip not found' });
    }

    const trip = tripResult.rows[0];

    // Generate plan with Gemini
    const stops = await generateTripPlan(trip);

    // Save stops to DB with real nearby places
    const savedStops = [];
    for (const stop of stops) {
      // Geocode the stop location
      const coords = await geocodeLocation(stop.search_location || stop.location_description);
      
      let nearbyPlaces = [];
      if (coords) {
        // Find real nearby places
        const rawPlaces = await findNearbyPlaces(coords.lat, coords.lng, stop.place_type);
        // Rank based on trip type
        nearbyPlaces = rankPlacesForTripType(rawPlaces, trip.trip_type, stop.stop_type);

        // Save top places to places table
        for (const place of nearbyPlaces.slice(0, 3)) {
          await pool.query(
            `INSERT INTO places (name, lat, lng, place_type, our_score, price_category)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT DO NOTHING`,
            [place.name, place.lat, place.lng, place.amenity, place.our_score, place.price_category]
          );
        }
      }

      const result = await pool.query(
        `INSERT INTO trip_stops 
          (trip_id, stop_type, suggested_time, sequence_order, notes)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [
          trip.id,
          stop.stop_type,
          stop.suggested_time,
          stop.sequence,
          `${stop.location_description} | ${stop.notes} | Category: ${stop.price_category}`
        ]
      );

      savedStops.push({
        ...result.rows[0],
        nearby_places: nearbyPlaces.slice(0, 3),
        coords
      });
    }

    // Update trip status
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

module.exports = router;