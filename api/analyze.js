// pages/api/gemini-handler.js
// Enhanced: exponential backoff, multi-model fallback, detailed diagnostics
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const { selectedAsset } = req.body || {};
    if (!selectedAsset || !selectedAsset.trim()) {
      return res.status(400).json({ error: 'Selected asset is required' });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({ error: 'Missing GEMINI_API_KEY in environment' });
    }

    // Models: comma-separated env OR defaults (primary, secondary, cheap)
    // Example: GEMINI_MODELS="gemini-2.0-flash,gemini-2.0-pro,gemini-2.0-flash-lite"
    const modelsEnv = process.env.GEMINI_MODELS || 'gemini-2.0-flash,gemini-2.0-flash-lite';
    const models = modelsEnv.split(',').map(m => m.trim()).filter(Boolean);

    // Prompt (keep your Burmese prompt structure)
    const prompt = `
Professional Financial Analyst တစ်ယောက်အနေဖြင့် အောက်ပါအချက်များကို တိကျစွာသုံးသပ်ပေးပါ။ အဖြေအားလုံးကို မြန်မာဘာသာဖြင့်သာ ပြန်လည်ဖြေကြားပါ။ အရေးကြီးသော အဖြစ်အပျက်တိုင်းတွင် နေ့စွဲ (Date) ကို ထည့်သွင်းဖော်ပြပါ။

Asset: ${selectedAsset}

1.  **သတင်းအကျဉ်းချုပ် (News Summary):** Google Search ကိုသုံး၍ ${selectedAsset} နှင့်ပတ်သက်သော နောက်ဆုံး 24-48 နာရီအတွင်း အရေးအကြီးဆုံး သတင်းတစ်ပုဒ်ကိုရှာပါ။ **ထိုသတင်းထွက်ခဲ့သည့် နေ့စွဲကို ဖော်ပြပြီး** အဓိကအချက် ၃ ချက်ဖြင့် အကျဉ်းချုပ်ပေးပါ။
...
(သင့်ရဲ့ prompt ကိုအပြီးအနောက်ထည့်ပါ)
    `;

    const payload = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 1500 }
    };

    // Exponential backoff + jitter
    function sleep(ms) {
      return new Promise(resolve => setTimeout(resolve, ms));
    }
    function jitter(base) {
      return base + Math.floor(Math.random() * base);
    }

    // Try one model with retries
    async function tryModel(model) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(apiKey)}`;

      const maxAttempts = 3; // per-model retry attempts
      let attempt = 0;
      let lastError = null;

      while (attempt < maxAttempts) {
        attempt++;
        const controller = new AbortController();
        const timeoutMs = 25_000;
        const to = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
            signal: controller.signal
          });
          clearTimeout(to);

          const bodyText = await resp.text().catch(() => null);
          let bodyJson = null;
          try { bodyJson = bodyText ? JSON.parse(bodyText) : null; } catch (e) { /* not JSON */ }

          if (resp.ok) {
            // Success — return parsed JSON
            return { ok: true, status: resp.status, body: bodyJson || bodyText };
          }

          // Not ok: check for rate/quota or transient errors
          const errMsg = bodyJson?.error?.message || bodyText || `HTTP ${resp.status}`;
          lastError = { status: resp.status, message: errMsg, raw: bodyJson || bodyText };

          // If rate-limited / quota, retry with backoff
          if (resp.status === 429 || /quota|rate limit|quotaExceeded/i.test(errMsg)) {
            const backoff = jitter(500 * attempt * attempt); // e.g. 500ms, 2000ms, etc
            await sleep(backoff);
            continue; // retry
          }

          // For 5xx we also retry
          if (resp.status >= 500 && resp.status < 600) {
            const backoff = jitter(400 * attempt * attempt);
            await sleep(backoff);
            continue;
          }

          // client error (4xx other than 429): don't retry
          return { ok: false, status: resp.status, body: bodyJson || bodyText, error: errMsg };
        } catch (err) {
          clearTimeout(to);
          lastError = { name: err.name, message: err.message };
          // Abort/timeout or network error -> retry a few times
          if (err.name === 'AbortError' || /network|timeout/i.test(err.message)) {
            const backoff = jitter(600 * attempt * attempt);
            await sleep(backoff);
            continue;
          }
          // Other errors -> break
          break;
        }
      } // attempts

      return { ok: false, status: lastError?.status || 0, error: lastError?.message || 'unknown', raw: lastError };
    }

    // Try models in order
    const diagnostics = [];
    for (const model of models) {
      const start = Date.now();
      const r = await tryModel(model);
      const durationMs = Date.now() - start;

      diagnostics.push({ model, durationMs, result: r });

      if (r.ok) {
        // Extract text robustly
        const resultJson = r.body;
        let text =
          resultJson?.candidates?.[0]?.content?.parts?.[0]?.text ||
          resultJson?.outputText ||
          (typeof resultJson === 'string' ? resultJson : null);

        if (!text) {
          // If no text found, return diagnostic but continue to next model
          diagnostics.push({ note: 'No textual output found in response; trying next model' });
          continue;
        }

        // Success: return result and diagnostics
        return res.status(200).json({
          ok: true,
          modelUsed: model,
          result: text,
          diagnostics
        });
      } else {
        // if non-retriable client error, keep going to next model but record
        // continue loop
      }
    }

    // If we reach here, all models failed
    return res.status(502).json({
      ok: false,
      error: 'All models failed',
      diagnostics,
      hint: 'Check API key, billing, enabled Generative Language API, and quota/rate-limits. Also review model names in GEMINI_MODELS env var.'
    });

  } catch (err) {
    console.error('Handler unexpected error:', err);
    return res.status(500).json({ ok: false, error: String(err?.message || err) });
  }
}
