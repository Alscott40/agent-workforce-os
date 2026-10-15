export default async function handler(req, res) {
  // Simple server-side proxy for Google Gemini (Generative Language API)
  // Expects POST { question: string }
  // Requires GEMINI_API_KEY environment variable to be set in the deployment (do NOT put keys in client-side code).

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const API_KEY = process.env.GEMINI_API_KEY;
  if (!API_KEY) {
    return res.status(400).json({ ok: false, error: 'GEMINI_API_KEY not configured on server. Set GEMINI_API_KEY environment variable.' });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ ok: false, error: 'Method not allowed, use POST' });
  }

  try {
    const body = req.body || {};
    const question = (body.question || body.prompt || '').toString();
    if (!question) return res.status(400).json({ ok: false, error: 'Missing question in request body' });

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${API_KEY}`;

    const payload = {
      // minimal compatibility payload — adapt as needed for your usage
      contents: [{ parts: [{ text: question }] }]
    };

    const r = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await r.json();
    // forward status and body
    res.status(r.status).json({ ok: r.ok, status: r.status, data });
  } catch (err) {
    console.error('api/chat error', err);
    res.status(500).json({ ok: false, error: err.message });
  }
}
