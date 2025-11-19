// This file handles requests for the sentiment dashboard cards.

// Helper function to parse asset strings (e.g., "Gold (XAU/USD)")
function parseAsset(assetString) {
    if (assetString.includes('/')) {
        let pair = assetString.match(/\((.*?)\)/);
        if (pair) {
            const [base, quote] = pair[1].split('/');
            return { base, quote, pair: assetString };
        }
        const [base, quote] = assetString.split('/');
        return { base, quote, pair: assetString };
    }
    return { base: assetString, quote: 'Market', pair: assetString };
}

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { asset } = req.body;
        const apiKey = process.env.GEMINI_API_KEY;

        if (!asset || !apiKey) {
            return res.status(400).json({ error: 'Missing asset or API key configuration.' });
        }

        const { base, quote, pair } = parseAsset(asset.value);
        const prompt = `Analyze the current fundamental strength of ${base} versus ${quote} based on the very latest news and economic data. Provide a percentage strength for the base asset (${base}) and a percentage strength for the quote asset (${quote}). The two percentages must add up to 100. Based on these percentages, determine the overall market sentiment for the ${pair} as "Bullish", "Bearish", or "Neutral". Your entire response MUST be a single, valid JSON object following this exact format. Do not include any text, explanations, or markdown formatting outside of the JSON object. {"base_strength": <number>,"quote_strength": <number>,"sentiment": "<string>"}`;

const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ "google_search": {} }],
        };

        const geminiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) {
            const errorBody = await geminiResponse.text();
            console.error("Gemini API Error:", errorBody);
            return res.status(geminiResponse.status).json({ error: 'Failed to fetch from Gemini API' });
        }

        const result = await geminiResponse.json();
        const textResponse = result.candidates?.[0]?.content?.parts?.[0]?.text;

        if (textResponse) {
            const jsonMatch = textResponse.match(/{[\s\S]*}/);
            if (jsonMatch) {
                const data = JSON.parse(jsonMatch[0]);
                return res.status(200).json({ result: data, quote: quote });
            }
        }
        
        return res.status(500).json({ error: 'Could not parse JSON from Gemini response' });

    } catch (error) {
        console.error('Server-side error:', error);
        return res.status(500).json({ error: error.message });
    }
}

