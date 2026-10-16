export default async function handler(req, res) {
  // Server-side proxy for Google Generative Language API (Gemini)
  // Accepts either a traditional API key (?key=...) or an OAuth/access token (Bearer).
  // Set GEMINI_API_KEY environment variable on the server to either:
  // - an API key starting with "AIzaSy..." (will be sent as ?key=KEY)
  // - an access token starting with "AQ." or "ya29." (will be sent in Authorization: Bearer <token>)
  
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

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

    // Use the modern endpoint (no API key param when using Bearer tokens)
    const baseUrl = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

    // Decide whether to use an API key query param or a Bearer Authorization header.
    const useBearer = API_KEY.startsWith('AQ.') || API_KEY.startsWith('ya29.') || API_KEY.startsWith('ya29');
    const url = useBearer ? baseUrl : `${baseUrl}?key=${API_KEY}`;

    const payload = {
      // minimal compatibility payload — adapt as needed for your usage
      contents: [{ parts: [{ text: question }] }]
    };

    const headers = { 'Content-Type': 'application/json' };
    if (useBearer) headers['Authorization'] = `Bearer ${API_KEY}`;

    const r = await fetch(url, {
      method: 'POST',
      headers,
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
