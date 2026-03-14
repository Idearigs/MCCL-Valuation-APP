const express = require('express');
const pool = require('../db');
const requireAuth = require('../middleware/auth');

const router = express.Router();
router.use(requireAuth);

// GET /api/probate
router.get('/', async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT id, executor_name, deceased_name, date_of_death,
              total_market_value, status, created_at, updated_at
       FROM probate_valuations ORDER BY created_at DESC`
    );
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET /api/probate/:id
router.get('/:id', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM probate_valuations WHERE id = $1', [req.params.id]);
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// POST /api/probate
router.post('/', async (req, res) => {
  try {
    const {
      executor_name, executor_address, contact_number, email,
      deceased_name, probate_reference, date_of_death,
      schedule_html, total_market_value, images
    } = req.body;

    const status = (executor_name && deceased_name && date_of_death) ? 'complete' : 'draft';

    const { rows } = await pool.query(
      `INSERT INTO probate_valuations
         (executor_name, executor_address, contact_number, email,
          deceased_name, probate_reference, date_of_death,
          schedule_html, total_market_value, images, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING *`,
      [
        executor_name || '', executor_address || '', contact_number || '', email || '',
        deceased_name || '', probate_reference || '', date_of_death || null,
        schedule_html || '', total_market_value || '',
        JSON.stringify(images || []), status
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// PUT /api/probate/:id
router.put('/:id', async (req, res) => {
  try {
    const {
      executor_name, executor_address, contact_number, email,
      deceased_name, probate_reference, date_of_death,
      schedule_html, total_market_value, images
    } = req.body;

    const status = (executor_name && deceased_name && date_of_death) ? 'complete' : 'draft';

    const { rows } = await pool.query(
      `UPDATE probate_valuations SET
         executor_name=$1, executor_address=$2, contact_number=$3, email=$4,
         deceased_name=$5, probate_reference=$6, date_of_death=$7,
         schedule_html=$8, total_market_value=$9, images=$10, status=$11,
         updated_at=NOW()
       WHERE id=$12 RETURNING *`,
      [
        executor_name || '', executor_address || '', contact_number || '', email || '',
        deceased_name || '', probate_reference || '', date_of_death || null,
        schedule_html || '', total_market_value || '',
        JSON.stringify(images || []), status, req.params.id
      ]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// DELETE /api/probate/:id
router.delete('/:id', async (req, res) => {
  try {
    const { rowCount } = await pool.query('DELETE FROM probate_valuations WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Not found' });
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
