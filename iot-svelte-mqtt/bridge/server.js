// bridge/server.js
const mqtt = require('mqtt');
const WebSocket = require('ws');

// Configuration MQTT
const MQTT_BROKER_URL = 'mqtt://captain.dev0.pandor.cloud:1884';
const MQTT_TOPIC_TELEMETRY = 'classroom/+/telemetry';
const MQTT_TOPIC_FLIPPER = 'flipper/+/+'; // Pour le bonus flipper

// Configuration WebSocket
const WS_PORT = 8080;

// --- Serveur WebSocket ---
const wss = new WebSocket.Server({ port: WS_PORT });

wss.on('listening', () => {
    console.log(`WebSocket server started on ws://localhost:${WS_PORT}`);
});

wss.on('connection', ws => {
    console.log('Client connected to WebSocket');
    ws.on('close', () => console.log('Client disconnected from WebSocket'));
    ws.on('error', error => console.error('WebSocket error:', error));
});

// Fonction pour envoyer un message à tous les clients WebSocket connectés
function broadcast(message) {
    wss.clients.forEach(client => {
        if (client.readyState === WebSocket.OPEN) {
            client.send(message);
        }
    });
}

// --- Client MQTT ---
const mqttClient = mqtt.connect(MQTT_BROKER_URL);

mqttClient.on('connect', () => {
    console.log(`Connected to MQTT broker: ${MQTT_BROKER_URL}`);
    // S'abonner aux topics de télémétrie
    mqttClient.subscribe(MQTT_TOPIC_TELEMETRY, err => {
        if (err) {
            console.error(`Error subscribing to ${MQTT_TOPIC_TELEMETRY}:`, err);
        } else {
            console.log(`Subscribed to MQTT topic: ${MQTT_TOPIC_TELEMETRY}`);
        }
    });
    // S'abonner aux topics Flipper (pour le bonus)
    mqttClient.subscribe(MQTT_TOPIC_FLIPPER, err => {
        if (err) {
            console.error(`Error subscribing to ${MQTT_TOPIC_FLIPPER}:`, err);
        } else {
            console.log(`Subscribed to MQTT topic: ${MQTT_TOPIC_FLIPPER}`);
        }
    });
});

mqttClient.on('message', (topic, message) => {
    // console.log(`MQTT message received on topic "${topic}": ${message.toString()}`);
    // Transmettre le message MQTT aux clients WebSocket
    broadcast(JSON.stringify({ topic, payload: message.toString() }));
});

mqttClient.on('error', error => {
    console.error('MQTT error:', error);
});

mqttClient.on('close', () => {
    console.log('Disconnected from MQTT broker');
});

process.on('SIGINT', () => {
    console.log('Shutting down...');
    mqttClient.end();
    wss.close(() => console.log('WebSocket server closed.'));
    process.exit();
});