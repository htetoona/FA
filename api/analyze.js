// Gemini Handler with Auto-Retry + Model Fallback + Quota-Safe Logic
// Save as: /pages/api/gemini-handler.js

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { selectedAsset } = request.body || {};
    if (!selectedAsset || !selectedAsset.trim()) {
      return response.status(400).json({ error: 'Selected asset is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return response.status(500).json({ error: 'Missing GEMINI_API_KEY' });
    }

    // Primary → fallback model
    const MODEL_PRIMARY = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
    const MODEL_FALLBACK = 'gemini-2.0-flash-lite'; // cheap & low-quota

    const prompt = `
Professional Financial Analyst တစ်ယောက်အနေဖြင့် အောက်ပါအချက်များကို တိကျစွာသုံးသပ်ပေးပါ။ အဖြေအားလုံးကို မြန်မာဘာသာဖြင့်သာ ပြန်လည်ဖြေကြားပါ။
... (same original Burmese prompt content) ...
Asset: ${selectedAsset}
    `;

    // Simple payload
    function makePayload(text) {
      return {
        contents: [{ parts: [{ text }] }],
        generationConfig: {
          maxOutputTokens: 1800 // quota safe
        }
      };
    }

    async function callGemini(model, payload, retryCount = 0) {
      const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 25000);

      try {
        const res = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
          signal: controller.signal
        });

        clearTimeout(timeout);

        // SUCCESS
        if (res.ok) {
          return await res.json();
        }

        const errData = await res.json().catch(() => ({}));
        const msg = errData?.error?.message || `HTTP ${res.status}`;

        // QUOTA / RATE LIMIT → retry
        if (msg.includes('quota') || msg.includes('rate') || res.status === 429) {
          if (retryCount < 2) {
            await new Promise(r => setTimeout(r, 800 * (retryCount + 1)));
            return callGemini(model, payload, retryCount + 1);
          }
        }

        // FAIL HARD
        throw new Error(msg);
      } catch (e) {
        clearTimeout(timeout);
        if (e.name === 'AbortError') {
          throw new Error('Request timeout');
        }
        throw e;
      }
    }

    const payload = makePayload(prompt);
    let result;

    // 1) Try primary model
    try {
      result = await callGemini(MODEL_PRIMARY, payload);
    } catch (primaryError) {
      // 2) Fallback model
      try {
        result = await callGemini(MODEL_FALLBACK, payload);
      } catch (fallbackError) {
        return response.status(500).json({
          error: 'Both primary and fallback model failed',
          primary: primaryError.message,
          fallback: fallbackError.message
        });
      }
    }

    // Extract text
    let text =
      result?.candidates?.[0]?.content?.parts?.[0]?.text ||
      result?.outputText ||
      null;

    if (!text) {
      return response.status(500).json({
        error: 'Unexpected Gemini API format',
        raw: result
      });
    }

    return response.status(200).json({ result: text });
  } catch (err) {
    return response.status(500).json({ error: err.message });
  }
}
