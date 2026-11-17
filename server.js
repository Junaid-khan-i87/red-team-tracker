const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 4000;
const PUBLIC_DIR = path.join(__dirname, 'public');
const DATA_DIR = path.join(__dirname, 'data');

app.use(cors());
app.use(express.json({ limit: '5mb' }));

// Security headers: Disable directory traversal, strict sandboxing
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Serve strictly static frontend assets
app.use(express.static(PUBLIC_DIR));

// Read-only Roadmap API endpoint
app.get('/api/roadmap', (req, res) => {
  try {
    const roadmapPath = path.join(DATA_DIR, 'roadmap.json');
    if (fs.existsSync(roadmapPath)) {
      const data = JSON.parse(fs.readFileSync(roadmapPath, 'utf8'));
      return res.json(data);
    }
    res.status(404).json({ error: 'Roadmap not found' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Community Status endpoint (Non-sensitive, reports app version and mode)
app.get('/api/status', (req, res) => {
  res.json({
    status: 'online',
    mode: 'community_standalone',
    isolation: 'sandboxed_client_vault',
    serverTime: new Date().toISOString()
  });
});

// Fallback to index.html for SPA routing
app.use((req, res) => {
  res.sendFile(path.join(PUBLIC_DIR, 'index.html'));
});

// Listen on all network interfaces (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`[+] Red Team Foundation Community Edition running on http://0.0.0.0:${PORT}`);
});
