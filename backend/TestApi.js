require("dotenv").config();
const axios = require("axios");
const fs = require("fs");

// ==========================
// 🎤 Deepgram Test (Speech-to-Text)
// ==========================
async function testDeepgram() {
    try {
        console.log("\n🔍 Testing Deepgram API...");

        // Sample audio file (you can replace with your own)
        const audioUrl =
            "https://static.deepgram.com/examples/Bueller-Life-moves-pretty-fast.wav";

        const response = await axios.post(
            "https://api.deepgram.com/v1/listen",
            { url: audioUrl },
            {
                headers: {
                    Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
                    "Content-Type": "application/json",
                },
            }
        );

        const transcript =
            response.data.results.channels[0].alternatives[0].transcript;

        console.log("✅ Deepgram Success!");
        console.log("Transcript:", transcript);
    } catch (error) {
        console.error("❌ Deepgram Error:");
        console.error(error.response?.data || error.message);
    }
}

// ==========================
// 🔊 ElevenLabs Test (Text-to-Speech)
// ==========================
async function testElevenLabs() {
    try {
        console.log("\n🔍 Testing ElevenLabs API...");

        const text = "Hello! Your ElevenLabs API is working perfectly.";

        const response = await axios.post(
            "https://api.elevenlabs.io/v1/text-to-speech/6YYGCbd5yCjXCXdERysb",
            {
                text: "That’s really impressive… I see that you’ve worked with WebSockets in your project, which is not something every student explores early on. It shows a strong understanding of real-time systems and communication between clients and servers.I’d like you to explain your approach in a bit more detail… how did you implement WebSockets in your application, and what challenges did you face while handling multiple users or real-time updates?Also, to understand your fundamentals better, could you compare WebSockets with traditional HTTP and Server-Sent Events? Specifically, how do they differ in terms of communication style, performance, and real-time capabilities… and in what scenarios would you choose one over the others?",
                model_id: "eleven_turbo_v2",
                voice_settings: {
                    stability: 0.4,
                    similarity_boost: 0.8,
                    style: 0.5,
                    use_speaker_boost: false
                }
            },
            {
                headers: {
                    "xi-api-key": process.env.ELEVENLABS_API_KEY,
                    "Content-Type": "application/json",
                    "accept": "audio/mpeg"
                },
                responseType: "arraybuffer"
            }
        );

        fs.writeFileSync("output.mp3", response.data);

        console.log("✅ ElevenLabs Success!");
        console.log("Audio saved as output.mp3");
    } catch (error) {
        console.error("❌ ElevenLabs Error:");

        if (error.response) {
            try {
                // Convert buffer → string → JSON
                const data = JSON.parse(error.response.data.toString());
                console.error(JSON.stringify(data, null, 2));
            } catch (e) {
                console.error(error.response.data.toString());
            }
        } else {
            console.error(error.message);
        }
    }
}

// ==========================
// 🚀 Run Tests
// ==========================
async function runTests() {
    //await testDeepgram();
    await testElevenLabs();
}

runTests();