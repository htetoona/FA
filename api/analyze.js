// Next.js / Vercel serverless handler
// Save as: /pages/api/gemini-analysis.js  (or your preferred path)

export default async function handler(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const { selectedAsset } = request.body || {};
    if (!selectedAsset || typeof selectedAsset !== 'string' || !selectedAsset.trim()) {
      return response.status(400).json({ error: 'Selected asset is required' });
    }

    // Read API key and optional model from environment (set these in Vercel dashboard)
    const apiKey = process.env.GEMINI_API_KEY;
    const model = process.env.GEMINI_MODEL || 'gemini-2.0-flash'; // override via env if needed

    if (!apiKey) {
      console.error('Missing GEMINI_API_KEY in environment');
      return response.status(500).json({ error: 'Server misconfiguration: missing API key' });
    }

    // Build prompt (keeps your original Burmese prompt structure)
    const prompt = `
Professional Financial Analyst တစ်ယောက်အနေဖြင့် အောက်ပါအချက်များကို တိကျစွာသုံးသပ်ပေးပါ။ အဖြေအားလုံးကို မြန်မာဘာသာဖြင့်သာ ပြန်လည်ဖြေကြားပါ။ အရေးကြီးသော အဖြစ်အပျက်တိုင်းတွင် နေ့စွဲ (Date) ကို ထည့်သွင်းဖော်ပြပါ။

Asset: ${selectedAsset}

1.  **သတင်းအကျဉ်းချုပ် (News Summary):** Google Search ကိုသုံး၍ ${selectedAsset} နှင့်ပတ်သက်သော နောက်ဆုံး 24-48 နာရီအတွင်း အရေးအကြီးဆုံး သတင်းတစ်ပုဒ်ကိုရှာပါ။ **ထိုသတင်းထွက်ခဲ့သည့် နေ့စွဲကို ဖော်ပြပြီး** အဓိကအချက် ၃ ချက်ဖြင့် အကျဉ်းချုပ်ပေးပါ။ ဥပမာ- "(စက်တင်ဘာ ၃၀) - Fed ဥက္ကဌ၏ မိန့်ခွန်းအရ..."

2.  **အရေးကြီးသော စီးပွားရေးသတင်းများ (Economic Calendar):** Google Search ကိုသုံး၍ ${selectedAsset} အပေါ် သက်ရောက်မှုအရှိဆုံးဖြစ်မည့် လာမည့် 48-72 နာရီအတွင်းက Economic Calendar မှ အရေးကြီးဆုံး Event ၁ ခု သို့မဟုတ် ၂ ခုကို ဖော်ပြပါ။ Event တစ်ခုချင်းစီ၏ **ကျင်းပမည့် နေ့စွဲနှင့် အချိန် (သိနိုင်လျှင်)** ကို ထည့်သွင်းဖော်ပြပါ။ ထို့နောက် ဖြစ်နိုင်ခြေရှိသော သက်ရောက်မှု (ဥပမာ- Bullish/Bearish for the asset) ကိုပါ ရှင်းပြပါ။

3.  **ဈေးကွက်၏ ခံစားချက် (Market Sentiment):** Google Search မှရသော နောက်ဆုံးရသတင်းများနှင့် **မကြာသေးမီက ဖြစ်ပျက်ခဲ့သော အဖြစ်အပျက်များ (ဥပမာ- မနေ့က NFP data အရ...)** ကို အခြေခံ၍ ${selectedAsset} အတွက် လက်ရှိ Market Sentiment ကို (Bullish, Bearish, Neutral) စသဖြင့် သတ်မှတ်ပေးပါ။ သင်၏ သုံးသပ်ချက်အတွက် အကြောင်းผลကို နေ့စွဲများနှင့် ချိတ်ဆက်ပြီး အတိုချုပ်ရှင်းပြပါ။

သင်၏အဖြေကို အောက်ပါပုံစံအတိုင်း ခေါင်းစဉ်များဖြင့် ရှင်းလင်းစွာဖွဲ့စည်းပေးပါ-
### သတင်းအကျဉ်းချုပ်
- **[နေ့စွဲ]:** [အချက် ၁]
- [အချက် ၂]
- [အချက် ၃]

### အရေးကြီးသော စီးပွားရေးသတင်းများ
**Event Name:** [Event ရဲ့ နာမည်]
**Date & Time:** [နေ့စွဲနှင့် အချိန်]
**Potential Impact:** [သက်ရောက်မှု ရှင်းလင်းချက်]

### ဈေးကွက်၏ ခံစားချက်
**Sentiment:** [ဥပမာ- Bullish]
**Reasoning:** [အကြောင်းผล ရှင်းလင်းချက် (နေ့စွဲများဖြင့်)]
`;

    // Build payload for the Gemini generateContent endpoint
    // NOTE: we intentionally do NOT include any unsupported "tools" key here.
    const payload = {
      contents: [
        {
          // `parts` holds text chunks that the model will consume
          parts: [{ text: prompt }]
        }
      ]
      // optionally you can add generationConfig or other fields depending on your model & needs
    };

    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      model
    )}:generateContent?key=${encodeURIComponent(apiKey)}`;

    // Add a timeout using AbortController (works in modern Node / Vercel runtimes)
    const controller = new AbortController();
    const timeoutMs = 25_000; // 25 seconds
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    let geminiResponse;
    try {
      geminiResponse = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
    } finally {
      clearTimeout(timeout);
    }

    if (!geminiResponse.ok) {
      // Attempt to read error body for clearer message
      let errBody = null;
      try {
        errBody = await geminiResponse.json();
      } catch (e) {
        // ignore parse errors
      }
      const msg = errBody?.error?.message || `Generative API request failed with status ${geminiResponse.status}`;
      console.error('Gemini API error', msg, errBody);
      return response.status(502).json({ error: msg, details: errBody });
    }

    const result = await geminiResponse.json();

    // Robust extraction: support a couple of possible response shapes
    let text = null;

    // Common shape: result.candidates[0].content.parts[0].text
    text = result?.candidates?.[0]?.content?.parts?.[0]?.text || null;

    // Alternative shape some Gemini responses use
    if (!text) {
      // e.g. result.output[0].content[0].text or result.outputText
      text = result?.output?.[0]?.content?.[0]?.text || result?.outputText || null;
    }

    if (!text) {
      console.error('Unexpected Gemini response shape', JSON.stringify(result));
      return response.status(500).json({
        error: 'Unexpected API response shape from Gemini',
        raw: result
      });
    }

    // Success — return the model's text
    return response.status(200).json({ result: text });

  } catch (error) {
    // Distinguish abort/timeouts from other errors
    if (error && error.name === 'AbortError') {
      console.error('Request to Gemini timed out');
      return response.status(504).json({ error: 'Request to generative API timed out' });
    }

    console.error('Server-side Error:', error);
    return response.status(500).json({ error: String(error?.message || error) });
  }
}
