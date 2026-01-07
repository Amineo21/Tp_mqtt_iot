# Contrats MQTT

## Préfixe de base
`classroom/<deviceId>`
`flipper/<deviceId>`

## Topics de télémétrie (ESP32)
*   `classroom/<deviceId>/telemetry`
    *   **Description**: Données environnementales périodiques de l'ESP32.
    *   **Payload**: JSON (voir `examples.json`)

## Topics d'événements (ESP32)
*   `classroom/<deviceId>/events`
    *   **Description**: Événements spécifiques (ex: redémarrage, erreur).
    *   **Payload**: JSON (voir `examples.json`)

## Topics de commandes (pour contrôle futur)
*   `classroom/<deviceId>/cmd`
    *   **Description**: Commandes envoyées à l'ESP32.
    *   **Payload**: JSON (ex: `{"command": "reboot"}`)

## Topics de statut (pour état de l'appareil)
*   `classroom/<deviceId>/status`
    *   **Description**: Statut actuel de l'ESP32 (online/offline, mode).
    *   **Payload**: JSON (ex: `{"status": "online", "mode": "normal"}`)

## Topics Flipper (pour le bonus)
*   `flipper/<deviceId>/button_press`
    *   **Description**: Événement de pression de bouton sur le Flipper Zero.
    *   **Payload**: JSON (voir `examples.json`)
*   `flipper/<deviceId>/NFC_read`
    *   **Description**: Événement de lecture NFC sur le Flipper Zero.
    *   **Payload**: JSON (voir `examples.json`)