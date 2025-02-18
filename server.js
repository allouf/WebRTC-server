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

wss.on('connection', (ws, req) => {
    
	console.log('Client connected from IP req:', req.socket.remoteAddress);
	console.log('Client connected from IP address:', ws._socket.remoteAddress);

    if (peers.has(ws)) {
        console.log('Client already connected, reusing existing PeerState');
        return; 
    }

    const peerState = {
        ws: ws,
        authReady: false,
        authFailed: false,
        authTimeout: setTimeout(() => {
            if (!peerState.authReady) {
                console.error('Authentication timeout');
                peerState.authFailed = true; 
                ws.close(1011, 'Authentication timeout');
            }
        }, 15000),
    };
    peers.set(ws, peerState);

    clearTimeout(peerState.authTimeout);
    peerState.authTimeout = null;

    ws.on('message', (message) => {
        console.log('Control message:', message.toString());
        handleControlMessage(message, ws, peerState);
    });

    ws.on('close', () => {
        console.log('Client disconnected');
        peers.delete(ws);
    });
}); 

async function handleEphemeralKey(ws) {
    try {
		console.log('handle Ephemeral Key');
        /*const response = await fetch('https://api.openai.com/v1/realtime/sessions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                model: "gpt-4o-realtime-preview-2024-12-17",
                voice: "alloy"
            })
        });*/
		const response = await fetch('https://api.openai.com/v1/realtime', { 
		  method: 'POST',
		  headers: {
			'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
			'Content-Type': 'application/json',
			'OpenAI-Beta': 'realtime=v1' 
		  },
		  body: JSON.stringify({
			model: "gpt-4o-realtime-preview-2024-12-17",
			voice: "alloy"
		  })
		});
        
        const data = await response.json();
		console.log('Ephemeral key : ', data)
        if (!data.client_secret?.value) throw new Error('No client secret');
        
        ws.send(JSON.stringify({
            type: "ephemeral_key",
            key: data.client_secret.value,
            expires_at: data.client_secret.expires_at
        }));

        console.log('Ephemeral key sent to client:', data.client_secret.value); // Log the sent key
        
    } catch (error) {
        console.error('Ephemeral key error:', error);
        ws.send(JSON.stringify({ type: "error", message: error.message }));
    }
}

async function handleControlMessage(message, ws, peerState) {
    const controlMessage = JSON.parse(message);
    switch (controlMessage.type) {
        case 'request_ephemeral_key':
            await handleEphemeralKey(ws);
            break;
        case 'offer':
            await handleOffer(ws, controlMessage.sdp);
            break;
        case 'ice_candidate':
            handleIceCandidate(peerState, controlMessage);
            break;
        default:
            console.warn('Unknown control message type:', controlMessage.type);
    }
}

async function handleOffer(ws, offerSdp) {
    try {
        const peerState = peers.get(ws);
        if (!peerState) {
            throw new Error('Peer state not found');
        }

        const pc = new RTCPeerConnection({
            iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
            iceCandidatePoolSize: 10 
        });

        peerState.pc = pc;

        pc.onicecandidate = ({ candidate }) => {
            if (candidate) {
                ws.send(JSON.stringify({
                    type: 'ice_candidate',
                    candidate: {
                        candidate: candidate.candidate,
                        sdpMid: candidate.sdpMid,
                        sdpMLineIndex: candidate.sdpMLineIndex
                    }
                }));
            }
        };

        await pc.setRemoteDescription(new RTCSessionDescription({
            type: 'offer',
            sdp: offerSdp
        }));

        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        
        ws.send(JSON.stringify({
            type: 'answer',
            sdp: answer.sdp
        }));

    } catch (error) {
        console.error('Offer handling failed:', error);
        ws.send(JSON.stringify({
            type: 'error',
            message: 'Failed to handle offer'
        }));
    }
}

function handleIceCandidate(peerState, candidateData) {
    try {
        const iceCandidate = new RTCIceCandidate({
            candidate : candidateData.candidate,
            sdpMid: candidateData.sdpMid || 'audio',
            sdpMLineIndex: candidateData.sdpMLineIndex || 0
        });

        if (peerState.pc && peerState.pc.remoteDescription) {
            peerState.pc.addIceCandidate(iceCandidate).catch(err => {
                console.error('ICE candidate error:', err);
            });
        }
    } catch (error) {
        console.error('ICE candidate parsing failed:', error);
    }
}

app.get('/', (req, res) => {
	console.log(`called web base url!`); 
    res.send('<h1>Hello, World!</h1>'); // Respond with a simple HTML message
});

server.listen(port, "0.0.0.0", () => {
    console.log(`Server running on port ${port}`);
});