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

const GEMINI_MODEL = "gemini-3.1-flash-lite";

app.use(express.json({ limit: '10mb' }));
app.use(cors());

app.use(express.static(path.join(__dirname, 'public')));

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});

app.post('/api/chat', async (req, res) => {
    const { conversation } = req.body;
    try {
        if(!Array.isArray(conversation)) throw new Error('Messages must be an array');

        const contents = conversation.map(({ role, text, audio }) => {
            const parts = [];
            if (text) {
                parts.push({ text });
            }
            if (audio && audio.data && audio.mimeType) {
                parts.push({
                    inlineData: {
                        mimeType: audio.mimeType,
                        data: audio.data
                    }
                });
            }
            return { role, parts };
        });

        const response = await ai.models.generateContent({
            model:GEMINI_MODEL,
            contents,
            config: {
                temperature: 0.9,
                // systemInstruction: "Jawab hanya menggunakan bahasa Indonesia.",
                /*systemInstruction: `
                    Anda adalah asisten AI yang bertugas untuk membantu user dalam memahami bahasa Mandarin. Anda juga bisa untuk mengajarkan user mengenai materi-materi yang berhubungan dengan bahasa Mandarin. Namun, Anda tidak bisa untuk memberikan informasi yang berhubungan dengan politik, SARA, dan hal-hal yang negatif lainnya. Anda memiliki silabus pembelajaran dari yang paling basic sampai ke advanced. Pada awal percakapan, Anda harus melakukan tes terlebih dahulu untuk mengetahui kemampuan user dalam berbahasa Mandarin. Selalu identifikasi bahasa yang digunakan oleh user. Apabila user dengan kemampuan basic dalam bahasa Mandarin, gunakan bahasa yang diidentifikasi untuk memberikan penjelasan. Namun untuk user yang sudah advanced, Anda bisa menjelaskan dalam bahasa Mandarin maupun bahasa yang sudah diidentifikasi. Gunakan bahasa yang ramah, mudah dipahami, dan mendukung user untuk terus semangat dalam belajar. Jika user berkeinginan untuk belajar bahasa Mandarin, Anda bisa memberikan materi-materi yang sesuai dengan kemampuan user. Anda boleh membagikan informasi mengenai budaya China yang terkait dengan pembelajaran bahasa Mandarin. Hindari untuk menjawab pertanyaan yang tidak berkaitan dengan pembelajaran Mandarin. 
                `,
                */
               systemInstruction:`Anda bertindak sebagai pengajar bahasa Mandarin dalam bentuk yang fun seperti gamifikasi Duolingo. Berikan tes sederhana terlebih dahulu untuk mengetahui kemampuan user dalam berbahasa Mandarin. Setelah itu buatkan materi sesuai dengan level kemampuan user untuk mengenal kosakata dahulu baru kemudian tata bahasa atau kalimat yang berkaitan dengan kosakata yang sudah dipelajari. Untuk setap pengenalan kosakata baru, buatlah dalam format tabel yang berisikan kolom Karakter, Pinyin, Arti, dan Contoh Kalimat (dalam bahasa Mandarin, dan terjemahan dalam bahasa yang digunakan user). Setelah memberikan materi, berikan sedikit evaluasi yang menarik seperti game untuk mengetahui apakah user sudah paham dengan materi yang diberikan, test juga pelafalan user terhadap kosakata atau kalimat tersebut apakah sudah benar. Buatlah semirip mungkin cara pembelajarannya seperti Duolingo`,},
        })

        res.status(200).json({ result: response.text });
    } catch (e) {
        return res.status(500).json({
            error: e.message
        });
    }
})