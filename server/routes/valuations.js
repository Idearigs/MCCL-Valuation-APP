const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/valuations — list (no images/signature for performance)
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, customer_name, customer_address, valuation_date,
              total_range, insurance_value, number_of_items,
              status, created_at, updated_at
       FROM valuations ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/valuations/:id — full record including images & signature
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM valuations WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/valuations
router.post('/', async (req, res) => {
  try {
    const {
      customer_name, customer_address, valuation_date, schedule_html,
      pricing_rows, total_range, insurance_value, number_of_items,
      images, owner_signature
    } = req.body;

    const status = (customer_name && valuation_date && schedule_html && insurance_value) ? 'complete' : 'draft';

    const { rows } = await pool.query(
      `INSERT INTO valuations
         (customer_name, customer_address, valuation_date, schedule_html,
          pricing_rows, total_range, insurance_value, number_of_items,
          images, owner_signature, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        customer_name, customer_address, valuation_date || null, schedule_html,
        JSON.stringify(pricing_rows || []),
        total_range, insurance_value, number_of_items,
        JSON.stringify(images || []),
        owner_signature || '', status
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/valuations/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      customer_name, customer_address, valuation_date, schedule_html,
      pricing_rows, total_range, insurance_value, number_of_items,
      images, owner_signature
    } = req.body;

    const status = (customer_name && valuation_date && schedule_html && insurance_value) ? 'complete' : 'draft';

    const { rows } = await pool.query(
      `UPDATE valuations SET
         customer_name=$1, customer_address=$2, valuation_date=$3, schedule_html=$4,
         pricing_rows=$5, total_range=$6, insurance_value=$7, number_of_items=$8,
         images=$9, owner_signature=$10, status=$11, updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [
        customer_name, customer_address, valuation_date || null, schedule_html,
        JSON.stringify(pricing_rows || []),
        total_range, insurance_value, number_of_items,
        JSON.stringify(images || []),
        owner_signature || '', status, req.params.id
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/valuations/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM valuations WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
