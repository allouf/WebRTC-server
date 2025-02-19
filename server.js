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

app.use(express.json()); 
app.use((req, res, next) => { 
    res.header("Access-Control-Allow-Origin", "*"); 
    next(); 
});

app.post('/get-ephemeral-key', async (req, res) => {
    console.log("Received request for ephemeral key");
    try {
        const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4o-realtime-preview-2024-12-17",
                voice: "alloy",
                instructions: "You are a helpful assistant"
            })
        });
        
        if (!response.ok) {
            console.error("Error fetching from OpenAI:", response.status, response.statusText);
            return res.status(response.status).json({ error: "Failed to fetch from OpenAI" });
        }

        const data = await response.json();
        res.json({ key: data.client_secret.value });
    } catch (error) {
        console.error("Error in /get-ephemeral-key:", error);
        res.status(500).json({ error: error.message });
    }
});

app.get('/', (req, res) => {
	console.log(`called web base url!`); 
    res.send('<h1>Hello, World!</h1>'); // Respond with a simple HTML message
});

server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
});