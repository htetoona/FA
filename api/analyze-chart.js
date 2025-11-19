export default async function handler(request, response) {
    // Method Check
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // 1. Input Validation
        const { imageData, mimeType } = request.body;
        if (!imageData || !mimeType) {
            return response.status(400).json({ error: 'Image data and mimeType are required' });
        }
        
        // 2. API Key Configuration
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return response.status(500).json({ error: 'API Key not found' });
        }
        
        // 3. Model Name (Working Version)
        const modelName = "gemini-2.5-flash-preview-09-2025"; 
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        // 4. Define System Prompt & User Prompt
        const systemPrompt = "Professional Technical Analyst တစ်ယောက်အနေဖြင့် ဤ Trading Chart ပုံကို သုံးသပ်ပါ။ ဈေးကွက်၏ တည်ဆောက်ပုံ (Market Structure)၊ လားရာ (Trend)၊ အဓိက ထောက်တိုင်နှင့် ခုခံမှုနေရာများ (Key Support & Resistance Levels) နှင့် နောက်ဆုံးဖြစ်ပေါ်ခဲ့သော ဈေးနှုန်းလှုပ်ရှားမှု (Recent Price Action) တို့ကို အသေးစိတ်ခွဲခြမ်းစိတ်ဖြာပေးပါ။ Trader တစ်ယောက်၏ ရှုထောင့်မှ ပညာပေးသဘောဖြင့် အနှစ်ချုပ်သုံးသပ်ချက်ဖြင့် အဆုံးသတ်ပေးပါ။ သင်၏ အဖြေကို မြန်မာဘာသာဖြင့်သာ ပြန်လည်ဖြေကြားပါ။";

        // 5. Construct Payload (System Instruction + Image)
        const payload = {
            contents: [{ 
                role: "user",
                parts: [
                    {
                        inlineData: {
                            data: imageData,
                            mimeType: mimeType
                        }
                    },
                    { text: "Please analyze this chart." }
                ] 
            }],
            systemInstruction: { parts: [{ text: systemPrompt }] }
        };

        // 6. Call Gemini API
        const geminiResponse = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!geminiResponse.ok) {
            const errorData = await geminiResponse.json();
            console.error("Gemini API Error:", errorData);
            throw new Error(errorData.error ? errorData.error.message : 'API request failed');
        }

        const result = await geminiResponse.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
            response.status(200).json({ result: text });
        } else {
            throw new Error("AI မှ အချက်အလက် ပြန်လည်ရရှိခြင်းမရှိပါ");
        }

    } catch (error) {
        console.error("Server-side Error:", error);
        response.status(500).json({ error: error.message });
    }
}
