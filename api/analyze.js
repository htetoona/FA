export default async function handler(request, response) {
    if (request.method !== 'POST') {
        return response.status(405).json({ message: 'Method Not Allowed' });
    }

    const { selectedAsset } = request.body;
    if (!selectedAsset) {
        return response.status(400).json({ error: 'Selected asset is required' });
    }
    
    const apiKey = process.env.GEMINI_API_KEY;
    
    // Strategy: အရင်ဆုံး Search Tool နဲ့ တွဲပြီး gemini-1.5-flash-002 ကို စမ်းမယ်
    // မရရင် (Error တက်ရင်) Tool မပါဘဲ ရိုးရိုး Model နဲ့ ပြန်စမ်းမယ် (Fallback)
    
    const modelName = "gemini-1.5-flash-002"; // Latest Stable Model
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

    // Prompt
    const promptText = `
        Professional Financial Analyst တစ်ယောက်အနေဖြင့် အောက်ပါအချက်များကို တိကျစွာသုံးသပ်ပေးပါ။ အဖြေအားလုံးကို မြန်မာဘာသာဖြင့်သာ ပြန်လည်ဖြေကြားပါ။

        Asset: ${selectedAsset}

        1.  **သတင်းအကျဉ်းချုပ်:** ${selectedAsset} နှင့်ပတ်သက်သော နောက်ဆုံးရ သတင်းအကျဉ်းချုပ် (ရက်စွဲပါရမည်)။
        2.  **စီးပွားရေးသတင်းများ:** လာမည့်ရက်များအတွက် အရေးကြီးသော Economic Event များ။
        3.  **ဈေးကွက်ခံစားချက်:** Market Sentiment (Bullish/Bearish) နှင့် အကြောင်းပြချက်။

        ပုံစံ:
        ### သတင်းအကျဉ်းချုပ်
        ...
        ### အရေးကြီးသော စီးပွားရေးသတင်းများ
        ...
        ### ဈေးကွက်၏ ခံစားချက်
        ...
    `;

    const payloadWithSearch = {
        contents: [{ parts: [{ text: promptText }] }],
        tools: [{ googleSearch: {} }] // CamelCase syntax for v1beta
    };

    try {
        // Attempt 1: Try with Google Search Tool
        console.log(`Attempting with model: ${modelName} and Search Tool...`);
        const res1 = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadWithSearch)
        });

        if (res1.ok) {
            const data = await res1.json();
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (text) return response.status(200).json({ result: text });
        } 
        
        // If Attempt 1 failed (likely due to Tool/Model mismatch), try without tools
        console.log("Search tool failed or model not found with tool. Retrying without tools...");
        
        const payloadSimple = {
            contents: [{ parts: [{ text: promptText + "\n(မှတ်ချက်: တိုက်ရိုက် Search မရရှိသဖြင့် သင်၏ ရှိပြီးသား ဗဟုသုတဖြင့် သုံးသပ်ပေးပါ။)" }] }]
        };

        const res2 = await fetch(API_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payloadSimple)
        });

        if (!res2.ok) {
            const errorData = await res2.json();
            throw new Error(errorData.error ? errorData.error.message : 'Fallback request also failed');
        }

        const result = await res2.json();
        const text = result.candidates?.[0]?.content?.parts?.[0]?.text;
        
        if (text) {
            response.status(200).json({ result: text });
        } else {
            throw new Error("No content generated");
        }

    } catch (error) {
        console.error("Final Error:", error);
        response.status(500).json({ error: error.message });
    }
}
