require('dotenv').config(); 
const express = require('express'); 
const http = require('http'); 
const WebSocket = require('ws'); 
const fetch = require('node-fetch'); 
const { RTCPeerConnection, RTCSessionDescription, RTCIceCandidate } = require('wrtc');

const app = express(); 
const server = http.createServer(app); 
const wss = new WebSocket.Server({ server });

const port = process.env.PORT || 8080; // Railway injects PORT

const peers = new Map();

const cors = require('cors');
app.use(cors({
  origin: '*',
  methods: ['POST', 'GET'],
  allowedHeaders: ['Content-Type']
}));

// Add OPTIONS handler
app.options('*', cors()); 

app.use(express.json()); 
app.use((req, res, next) => { 
    res.header("Access-Control-Allow-Origin", "*"); 
    next(); 
});

app.post('/get-ephemeral-key', async (req, res) => {
    try {
        console.log("Request body:", req.body); // Add logging
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                "Authorization": `Bearer ${process.env.OPENAI_API_KEY}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                model: "gpt-4o-realtime-preview-2024-12-17",
                voice: "alloy",
                instructions: "You are a helpful assistant",
                input_audio_transcription: { model: "whisper-1" }
            })
        });

        const data = await response.json();
        console.log("OpenAI response:", data);
        
        if (!data?.client_secret?.value) {
            throw new Error('Invalid response from OpenAI');
        }
        
        res.json({ 
            key: data.client_secret.value,
            expires_at: data.client_secret.expires_at
        });

    } catch (error) {
        console.error("Full error:", error);
        res.status(500).json({ 
            error: error.message,
            stack: error.stack
        });
    }
});

app.get('/', (req, res) => {
	console.log(`called web base url!`); 
    res.send('<h1>Hello, World!</h1>'); // Respond with a simple HTML message
});

server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
});