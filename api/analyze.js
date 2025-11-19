export default async function handler(request, response) {
    // Method Check
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // 1. Input Validation
        let { selectedAsset } = request.body;
        if (!selectedAsset) {
            return response.status(400).json({ error: 'Selected asset is required' });
        }

        // 2. API Key Configuration
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return response.status(500).json({ error: 'API Key not found' });
        }

        // 3. Model Name (Working Version)
        const modelName = "gemini-2.5-flash-preview-09-2025";
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        // 4. Get Current Date for News Accuracy
        const today = new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
        });

        // 5. Prepare Prompt
        const prompt = `
            Current Date: ${today}
            
            Professional Financial Analyst တစ်ယောက်အနေဖြင့် အောက်ပါအချက်များကို တိကျစွာသုံးသပ်ပေးပါ။ အဖြေအားလုံးကို မြန်မာဘာသာဖြင့်သာ ပြန်လည်ဖြေကြားပါ။

            Asset: ${selectedAsset}

            1.  **သတင်းအကျဉ်းချုပ် (News Summary):** Google Search ကိုသုံး၍ ${selectedAsset} နှင့်ပတ်သက်သော ယနေ့ (${today}) မှ နောက်ကြောင်းပြန် 24-48 နာရီအတွင်း အရေးအကြီးဆုံး သတင်းတစ်ပုဒ်ကိုရှာပါ။ **ထိုသတင်းထွက်ခဲ့သည့် နေ့စွဲကို ဖော်ပြပြီး** အဓိကအချက် ၃ ချက်ဖြင့် အကျဉ်းချုပ်ပေးပါ။

            2.  **အရေးကြီးသော စီးပွားရေးသတင်းများ (Economic Calendar):** Google Search ကိုသုံး၍ ${selectedAsset} အပေါ် သက်ရောက်မှုအရှိဆုံးဖြစ်မည့် လာမည့် 48-72 နာရီအတွင်း (Starting from ${today}) Economic Calendar မှ အရေးကြီးဆုံး Event ၁ ခု သို့မဟုတ် ၂ ခုကို ဖော်ပြပါ။

            3.  **ဈေးကွက်၏ ခံစားချက် (Market Sentiment):** Google Search မှရသော နောက်ဆုံးရသတင်းများကို အခြေခံ၍ ${selectedAsset} အတွက် လက်ရှိ Market Sentiment ကို (Bullish, Bearish, Neutral) သတ်မှတ်ပေးပါ။

            (အောက်ပါ Format အတိုင်းသာ ဖြေကြားပါ)
            ### သတင်းအကျဉ်းချုပ်
            - **[နေ့စွဲ]:** [အချက် ၁]
            - [အချက် ၂]
            - [အချက် ၃]

            ### အရေးကြီးသော စီးပွားရေးသတင်းများ
            **Event Name:** [Event ရဲ့ နာမည်]
            **Date & Time:** [နေ့စွဲနှင့် အချိန်]
            **Potential Impact:** [သက်ရောက်မှု]

            ### ဈေးကွက်၏ ခံစားချက်
            **Sentiment:** [Bullish/Bearish/Neutral]
            **Reasoning:** [အကြောင်းပြချက်]
        `;

        // 6. Construct Payload with Google Search Tool
        const payload = {
            contents: [{ parts: [{ text: prompt }] }],
            tools: [{ google_search: {} }]
        };

        // 7. Call Gemini API
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
            throw new Error("AI မှ အချက်အလက် မရရှိပါ (Search Tool Error ဖြစ်နိုင်သည်)");
        }

    } catch (error) {
        console.error("Server-side Error:", error);
        response.status(500).json({ error: error.message });
    }
}
