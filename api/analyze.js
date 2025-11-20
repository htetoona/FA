export default async function handler(request, response) {
    // Method Check
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    try {
        // 1. Input Validation & Extraction (Updated to receive newsContext & clientTime)
        const { selectedAsset, newsContext, clientTime } = request.body;
        
        if (!selectedAsset) {
            return response.status(400).json({ error: 'Selected asset is required' });
        }

        // 2. API Key Configuration
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return response.status(500).json({ error: 'API Key not found' });
        }

        // 3. Model Name
        const modelName = "gemini-2.5-flash-preview-09-2025";
        const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

        // 4. Time Configuration (Use Client Time if available for accuracy)
        const referenceTime = clientTime || new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });

        // 5. Prepare Prompt (Updated Logic)
        let prompt = `
            Current Date/Time: ${referenceTime}
            Role: Professional Senior Financial Analyst & Forex Trader.
            Language: Myanmar (Burmese).
            Asset: ${selectedAsset}
        `;

        // --- CRITICAL UPDATE: Inject User Provided Live Data ---
        if (newsContext && newsContext.trim() !== "") {
            prompt += `
            \n\n🚨 **URGENT LIVE DATA UPDATE FROM USER:** 🚨
            The user has manually provided the following REAL-TIME economic data (e.g., from Forex Factory):
            "${newsContext}"

            **INSTRUCTION:** 1. You MUST prioritize this user-provided data over Google Search results if there is a conflict.
            2. Analyze the immediate impact of these specific numbers (Actual vs Forecast) on ${selectedAsset}.
            3. If the numbers are significantly different from the forecast, clearly state the expected market reaction (Bullish/Bearish).
            `;
        }
        // -------------------------------------------------------

        prompt += `
            \nTask: Analyze the following points precisely using Google Search and the provided data.

            1.  **သတင်းအကျဉ်းချုပ် (News Summary):** Google Search ကိုသုံး၍ ${selectedAsset} နှင့်ပတ်သက်သော ယနေ့ (${referenceTime}) မှ နောက်ကြောင်းပြန် 24-48 နာရီအတွင်း အရေးအကြီးဆုံး သတင်းတစ်ပုဒ်ကိုရှာပါ။ 
                (User မှ Live Data ပေးထားပါက ထိုအချက်အလက်ကို ဤနေရာတွင် ထည့်သွင်းဆွေးနွေးပါ)။

            2.  **အရေးကြီးသော စီးပွားရေးသတင်းများ (Economic Calendar):** လာမည့် 48-72 နာရီအတွင်း Economic Calendar မှ အရေးကြီးဆုံး Event ၁ ခု သို့မဟုတ် ၂ ခုကို ဖော်ပြပါ။
                (မှတ်ချက်: User မှပေးသော Data သည် ပြီးခဲ့သည့် Event ဖြစ်ပါက ၎င်း၏ သက်ရောက်မှုကို အဓိကထား သုံးသပ်ပါ)။

            3.  **ဈေးကွက်၏ ခံစားချက် (Market Sentiment):** လက်ရှိရရှိထားသော သတင်းအချက်အလက်များနှင့် User ပေးသော Live Data ကို အခြေခံ၍ Market Sentiment ကို (Bullish, Bearish, Neutral) သတ်မှတ်ပေးပါ။

            (Please answer in the following Format exactly)
            ### သတင်းအကျဉ်းချုပ်
            - **[နေ့စွဲ/အချိန်]:** [အချက် ၁ - User Data ရှိပါက ထိုအကြောင်းကို ဦးစားပေးပါ]
            - [အချက် ၂]
            - [အချက် ၃]

            ### အရေးကြီးသော စီးပွားရေးသတင်းများ
            **Event Name:** [Event ရဲ့ နာမည်]
            **Date & Time:** [နေ့စွဲနှင့် အချိန်]
            **Potential Impact:** [သက်ရောက်မှု သို့မဟုတ် ဖြစ်ပေါ်ခဲ့သော ရလဒ်]

            ### ဈေးကွက်၏ ခံစားချက်
            **Sentiment:** [Bullish/Bearish/Neutral]
            **Reasoning:** [အကြောင်းပြချက် - User ၏ Data ကြောင့် ဖြစ်လာနိုင်သော အပြောင်းအလဲကို ထည့်ရေးပါ]
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
