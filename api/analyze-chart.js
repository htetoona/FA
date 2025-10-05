export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        const { imageData, mimeType } = request.body;
        if (!imageData || !mimeType) {
            return response.status(400).json({ error: 'Image data and mimeType are required' });
        }
        
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return response.status(500).json({ error: 'API key is not configured on the server' });
        }
        
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        const prompt = `Professional Technical Analyst တစ်ယောက်အနေဖြင့် ဤ Trading Chart ပုံကို သုံးသပ်ပါ။ ဈေးကွက်၏ တည်ဆောက်ပုံ (Market Structure)၊ လားရာ (Trend)၊ အဓိက ထောက်တိုင်နှင့် ခုခံမှုနေရာများ (Key Support & Resistance Levels) နှင့် နောက်ဆုံးဖြစ်ပေါ်ခဲ့သော ဈေးနှုန်းလှုပ်ရှားမှု (Recent Price Action) တို့ကို အသေးစိတ်ခွဲခြမ်းစိတ်ဖြာပေးပါ။ Trader တစ်ယောက်၏ ရှုထောင့်မှ ပညာပေးသဘောဖြင့် အနှစ်ချုပ်သုံးသပ်ချက်ဖြင့် အဆုံးသတ်ပေးပါ။ သင်၏ အဖြေကို မြန်မာဘာသာဖြင့်သာ ပြန်လည်ဖြေကြားပါ။`;

        const payload = {
            contents: [{
                parts: [
                    { text: prompt },
                    {
                        inlineData: {
                            data: imageData,
                            mimeType: mimeType
                        }
                    }
                ]
            }]
        };

        const geminiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            throw new Error(errorData.error ? errorData.error.message : 'API request from Gemini failed');
        }

        const result = await geminiResponse.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
            response.status(200).json({ result: text });
        } else {
            throw new Error("AI မှ အချက်အလက် ပြန်လည်ရရှိခြင်းမရှိပါ");
        }

    } catch (error) {
        console.error("Server-side Error in analyze-chart:", error);
        response.status(500).json({ error: error.message });
    }
}
