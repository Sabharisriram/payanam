const express = require('express');
const router = express.Router();
const pool = require('../models/db');
const authGuard = require('../middleware/authGuard');

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

module.exports = router;