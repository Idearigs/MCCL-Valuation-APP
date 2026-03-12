require('dotenv').config();
const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const migrate = require('./migrate');
const seed = require('./seed');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '20mb' })); // larger limit for base64 images
app.set('trust proxy', 1);

app.use('/api/auth/login', rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many login attempts, try again later' },
}));

app.use('/api/', rateLimit({
  windowMs: 60 * 1000,
  max: 200,
  message: { error: 'Too many requests' },
}));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/valuations', require('./routes/valuations'));

app.get('/health', (_, res) => res.json({ status: 'ok', ts: new Date().toISOString() }));

// Serve React frontend
const clientDist = path.join(__dirname, 'dist');
app.use(express.static(clientDist));
app.get('*', (_req, res) => {
  res.sendFile(path.join(clientDist, 'index.html'));
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Internal server error' });
});

async function start() {
  try {
    await migrate();
    await seed();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`McCulloch Valuation API running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start:', err);
    process.exit(1);
  }
}

start();
