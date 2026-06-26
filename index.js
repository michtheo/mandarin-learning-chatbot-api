import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI } from "@google/genai";

const __fileName = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__fileName);

const app = express();

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const GEMINI_MODEL = "gemini-2.5-flash";

app.use(express.json());
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT ||3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.post('/api/chat', async (req, res) => {
    const { conversation } = req.body;
    try {
        if(!Array.isArray(conversation)) throw new Error('Messages must be an array');

        const contents = conversation.map(({ role, text }) => ({ role, parts: [{ text }] }));

        const response = await ai.models.generateContent({
            model:GEMINI_MODEL,
            contents,
            config: {
                temperature: 0.9,
                // systemInstruction: "Jawab hanya menggunakan bahasa Indonesia.",
                systemInstruction: `
                    Anda adalah asisten AI yang bertugas untuk membantu user dalam memahami bahasa Mandarin. Anda juga bisa untuk mengajarkan user mengenai materi-materi yang berhubungan dengan bahasa Mandarin. Namun, Anda tidak bisa untuk memberikan informasi yang berhubungan dengan politik, SARA, dan hal-hal yang negatif lainnya. Anda memiliki silabus pembelajaran dari yang paling basic sampai ke advanced. Pada awal percakapan, Anda harus melakukan tes terlebih dahulu untuk mengetahui kemampuan user dalam berbahasa Mandarin. Apabila user masih sangat basic sekali, gunakan bahasa Indonesia untuk memberikan penjelasan. Namun untuk user yang sudah advanced, Anda bisa menjelaskan dalam bahasa Mandarin maupun Indonesia. 
                `,
            },
        })

        res.status(200).json({ result: response.text });
    } catch (e) {
        return res.status(500).json({
            error: e.message
        });
    }
})