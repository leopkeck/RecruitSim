// server.js
import express from 'express';
import fetch from 'node-fetch'; // if you installed node-fetch@2, keep this import; otherwise remove and use global fetch in Node18+
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(helmet());
app.use(express.json({ limit: '128kb' }));

// basic rate limiting
const limiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60
});
app.use(limiter);

const AI_API_URL = process.env.AI_API_URL || 'https://api.openai.com/v1/chat/completions';
const API_KEY = process.env.OPENAI_API_KEY;
if (!API_KEY) {
  console.error('Missing OPENAI_API_KEY in environment. Add it to .env and restart.');
  process.exit(1);
}

app.post('/api/recruit/reply', async (req, res) => {
  try {
    const { playerId, conversation = [], latestCoachMessage = '' } = req.body;
    if (!playerId || !latestCoachMessage) {
      return res.status(400).json({ error: 'Missing playerId or latestCoachMessage' });
    }

    const systemMessage = {
      role: 'system',
      content: `You are a college recruit. Reply in first person, short and candid, with a friendly and informal tone. Ask one follow-up question when appropriate. Keep replies concise (20-80 words).`
    };

    const identityMessage = { role: 'system', content: `Player ID: ${playerId}` };

    // include the last few turns for context (map local roles to chat roles)
    const recent = (conversation || []).slice(-8).map(m => {
      return m.who === 'recruiter' ? { role: 'user', content: m.text } : { role: 'assistant', content: m.text };
    });

    const messages = [systemMessage, identityMessage, ...recent, { role: 'user', content: latestCoachMessage }];

    const payload = {
      model: process.env.AI_MODEL || 'gpt-4o-mini',
      messages,
      temperature: 0.8,
      max_tokens: 220,
      top_p: 0.95,
      frequency_penalty: 0.2
    };

    const r = await fetch(AI_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify(payload)
    });

    if (!r.ok) {
      const txt = await r.text();
      console.error('AI provider error', r.status, txt);
      return res.status(502).json({ error: 'AI provider error', detail: txt });
    }

    const data = await r.json();
    const aiText = data.choices?.[0]?.message?.content ?? data.choices?.[0]?.text ?? '';
    return res.json({ reply: aiText.trim(), raw: data });
  } catch (err) {
    console.error('Server error', err);
    return res.status(500).json({ error: 'Server error' });
  }
});

// serve your static client files from the public folder
app.use(express.static('public'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server listening on port ${PORT}`);
});
