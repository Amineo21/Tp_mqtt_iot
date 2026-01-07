<script lang="ts">
  import { onMount } from "svelte";
  import { writable } from "svelte/store";

  // Store Svelte pour stocker les dernières données de télémétrie reçues
  // Une Map est idéale pour stocker des données par deviceId
  const telemetryData = writable<Map<string, any>>(new Map());
  const flipperEvents = writable<any[]>([]); // Pour le bonus flipper

  onMount(() => {
    const websocket = new WebSocket("ws://localhost:8080");

    websocket.onopen = () => {
      console.log("Connected to WebSocket server");
    };

    websocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        const { topic, payload } = message;

        // Gérer les messages de télémétrie
        if (topic.includes("classroom") && topic.includes("telemetry")) {
          const deviceId = topic.split("/")[1]; // Extrait l'ID du device
          const data = JSON.parse(payload); // Le payload est une chaîne JSON
          telemetryData.update((map) => {
            map.set(deviceId, { ...data, lastUpdate: new Date() });
            return map;
          });
          // Console log pour vérifier la réception (peut être commenté une fois que tout fonctionne)
          // console.log(`Telemetry for ${deviceId}:`, data);
        }
        // Gérer les messages Flipper (pour le bonus)
        else if (topic.includes("flipper")) {
          const deviceId = topic.split("/")[1];
          const eventType = topic.split("/")[2];
          const data = JSON.parse(payload);
          flipperEvents.update((events) => {
            const newEvent = {
              deviceId,
              eventType,
              ...data,
              receivedAt: new Date(),
            };
            // Garder uniquement les 20 derniers événements
            return [newEvent, ...events].slice(0, 20);
          });
          // Console log pour vérifier la réception (peut être commenté une fois que tout fonctionne)
          // console.log(`Flipper event from ${deviceId} (${eventType}):`, data);
        }
      } catch (error) {
        console.error("Error parsing WebSocket message:", error);
        console.error("Raw message received:", event.data); // Utile pour le debug
      }
    };

    websocket.onclose = () => {
      console.log("Disconnected from WebSocket server");
    };

    websocket.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    // Fonction de nettoyage à l'unmount du composant
    return () => {
      websocket.close();
    };
  });

  // Mapping des deviceId vers des noms de lieux plus lisibles
  // Adaptez ces IDs aux IDs réels de vos ESP32
  const deviceLocations = new Map<string, string>([
    ["esp32-01", "Bureau Nord"],
    ["esp32-02", "Salle de Conférence"],
    ["esp32-03", "Laboratoire IoT"],
    ["esp32-04", "Réception"],
    ["esp32-05", "Cafeteria"],
    ["esp32-06", "Atelier"],
    ["esp32-07", "Zone de Test"],
    // Ajoutez d'autres mappings si vous connaissez les IDs exacts
    ["flipper_test", "Flipper Zero de test"],
  ]);

  // Fonction pour déterminer l'état (online/offline)
  function getDeviceStatus(
    lastUpdate: Date | undefined
  ): "online" | "offline" | "unknown" {
    if (!lastUpdate) return "unknown";
    const now = new Date();
    const diffMinutes = (now.getTime() - lastUpdate.getTime()) / (1000 * 60);
    return diffMinutes < 2 ? "online" : "offline"; // Considéré offline après 2 minutes sans mise à jour
  }

  // Fonction de formatage de date
  function formatRelativeTime(date: Date | undefined): string {
    if (!date) return "N/A";
    const now = new Date();
    const seconds = Math.round((now.getTime() - date.getTime()) / 1000);
    if (seconds < 60) return `${seconds}s ago`;
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) return `${minutes}min ago`;
    const hours = Math.round(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.round(hours / 24);
    return `${days}d ago`;
  }

  let filterLocation: string = ""; // Pour le bonus: filtre par lieu
  let filteredDevices: Map<string, any>; // Déclarer ici pour éviter l'erreur de "block-scoped variable"

  // Réagit aux changements de telemetryData ou filterLocation
  $: {
    const tempMap = new Map();
    $telemetryData.forEach((data, deviceId) => {
      const locationName = deviceLocations.get(deviceId) || deviceId;
      if (
        !filterLocation ||
        filterLocation === "all" ||
        locationName.toLowerCase().includes(filterLocation.toLowerCase())
      ) {
        tempMap.set(deviceId, data);
      }
    });
    filteredDevices = tempMap;
  }

  // Calcul de la moyenne globale pour la bonus UI
  $: globalAverage = (() => {
    let totalTemp = 0;
    let totalHum = 0;
    let onlineDevicesCount = 0;

    $telemetryData.forEach((data, deviceId) => {
        if (getDeviceStatus(data.lastUpdate) === 'online') {
            totalTemp += data.tempC || 0;
            // CORRECTION HUMIDITÉ ICI AUSSI
            totalHum += data.humPct || 0;
            onlineDevicesCount++;
        }
    });

    return {
        avgTemp: onlineDevicesCount > 0 ? (totalTemp / onlineDevicesCount).toFixed(1) : 'N/A',
        avgHum: onlineDevicesCount > 0 ? (totalHum / onlineDevicesCount).toFixed(1) : 'N/A',
        onlineCount: onlineDevicesCount
    };
})();
</script>

<div class="dashboard-container">
  <h1>Dashboard Météo IoT</h1>

  <!-- Bonus UI: Moyenne globale -->
  <div class="average-card">
    <div class="average-item">
      <h3>Température Moyenne</h3>
      <span class="average-value"
        >{globalAverage.avgTemp} <span class="unit">°C</span></span
      >
    </div>
    <div class="average-item">
      <h3>Humidité Moyenne</h3>
      <span class="average-value"
        >{globalAverage.avgHum} <span class="unit">%</span></span
      >
    </div>
    <div class="average-item">
      <h3>Appareils Actifs</h3>
      <span class="average-value"
        >{globalAverage.onlineCount} / {$telemetryData.size}</span
      >
    </div>
  </div>

  <!-- Bonus UI: Filtre par lieu -->
  <div class="filter-section">
    <label for="location-filter">Filtrer par lieu :</label>
    <select id="location-filter" bind:value={filterLocation}>
      <option value="all">Tous les lieux</option>
      {#each Array.from(deviceLocations.values()) as location}
        <option value={location}>{location}</option>
      {/each}
    </select>
  </div>

  <div class="cards-grid">
    {#each Array.from(filteredDevices.entries()) as [deviceId, data] (deviceId)}
      <div class="device-card {getDeviceStatus(data.lastUpdate)}">
        <div class="card-header">
          <h2>{deviceLocations.get(deviceId) || deviceId}</h2>
          <span class="status-indicator {getDeviceStatus(data.lastUpdate)}">
            {getDeviceStatus(data.lastUpdate)}
          </span>
        </div>
        <div class="card-content">
          <p>
            <strong>Température:</strong>
            <span class="value">{data.tempC?.toFixed(1) ?? "N/A"} °C</span>
          </p>
          <!-- CORRECTION HUMIDITÉ -->
          <p>
            <strong>Humidité:</strong>
            <span class="value">{data.humPct?.toFixed(1) ?? "N/A"} %</span>
          </p>
          <!-- CORRECTION BATTERIE -->
          <p>
            <strong>Batterie:</strong>
            <span class="value">{data.batteryPct ?? "N/A"} %</span>
          </p>
        </div>
        <div class="card-footer">
          Dernière mise à jour: {formatRelativeTime(data.lastUpdate)}
        </div>
      </div>
    {:else}
      <p>En attente de données météorologiques...</p>
    {/each}
  </div>

  <!-- Bonus - Flipper Interface -->
  <div class="flipper-section">
    <h2>Événements Flipper Zero</h2>
    {#if $flipperEvents.length > 0}
      <div class="flipper-event-list">
        {#each $flipperEvents as event (event.receivedAt.getTime() + event.deviceId + event.eventType)}
          <div class="flipper-event-item">
            <span class="event-type">{event.eventType}</span>
            <span class="device-id">({event.deviceId})</span>
            <!-- Affiche le payload, filtrant les clés déjà affichées ou non pertinentes -->
            <span class="payload"
              >{JSON.stringify(event, [
                "button",
                "action",
                "card_uid",
                "card_type",
                "ax",
                "ay",
                "az",
                "gx",
                "gy",
                "gz",
              ])}</span
            >
            <span class="timestamp">{formatRelativeTime(event.receivedAt)}</span
            >
          </div>
        {/each}
      </div>
    {:else}
      <p>En attente d'événements Flipper Zero...</p>
    {/if}
  </div>
</div>

<style lang="postcss">
  :global(body) {
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    background-color: #1a1a2e; /* Dark blue-purple */
    color: #e0e0e0; /* Light grey */
    margin: 0;
    padding: 20px;
    line-height: 1.6;
  }

  h1 {
    color: #0f4c75; /* Steel blue */
    text-align: center;
    margin-bottom: 40px;
    font-size: 2.8em;
    font-weight: 300;
    letter-spacing: 1px;
  }

  .dashboard-container {
    max-width: 1200px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 30px;
  }

  .filter-section {
    display: flex;
    justify-content: center;
    align-items: center;
    margin-bottom: 20px;
    gap: 15px;
  }

  .filter-section label {
    margin-right: 5px;
    font-weight: bold;
    color: #bbe1fa;
    font-size: 1.1em;
  }

  .filter-section select {
    padding: 10px 15px;
    border-radius: 8px;
    border: 1px solid #3282b8; /* Lighter steel blue */
    background-color: #0f4c75; /* Steel blue */
    color: #e0e0e0;
    cursor: pointer;
    outline: none;
    font-size: 1em;
    appearance: none; /* Remove default dropdown arrow */
    background-image: url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23bbe1fa%22%20d%3D%22M287%2C114.7L154.5%2C247.2c-2.9%2C2.9-6.8%2C4.4-10.7%2C4.4c-3.9%2C0-7.8-1.5-10.7-4.4L5.4%2C114.7c-5.8-5.8-5.8-15.2%2C0-21s15.2-5.8%2C21%2C0l118.8%2C118.7l118.7-118.7c5.8-5.8%2C15.2-5.8%2C21%2C0S292.8%2C108.9%2C287%2C114.7z%22%2F%3E%3C%2Fsvg%3E");
    background-repeat: no-repeat;
    background-position: right 10px top 50%;
    background-size: 1em;
  }
  .filter-section select:focus {
    border-color: #bbe1fa;
    box-shadow: 0 0 0 3px rgba(187, 225, 250, 0.4);
  }

  .average-card {
    background-color: #2b2b45; /* Darker blue-purple */
    border-radius: 15px;
    padding: 30px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
    display: flex;
    justify-content: space-around;
    align-items: center;
    margin-bottom: 30px;
    border-left: 6px solid #3282b8; /* Lighter steel blue */
    gap: 20px;
    flex-wrap: wrap; /* Allow wrapping on smaller screens */
  }

  .average-item {
    text-align: center;
    flex: 1;
    min-width: 150px; /* Ensure items don't get too small */
  }

  .average-item h3 {
    margin-bottom: 12px;
    color: #bbe1fa; /* Light blue */
    font-size: 1.3em;
    font-weight: 400;
  }

  .average-value {
    font-size: 2.8em;
    font-weight: bold;
    color: #bbe1fa; /* Light blue */
    display: block; /* Ensure it takes full width */
  }
  .average-item span.unit {
    font-size: 0.8em;
    color: #a0a0a0;
    margin-left: 5px;
  }

  .cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: 30px;
  }

  .device-card {
    background-color: #2b2b45; /* Darker blue-purple */
    border-radius: 15px;
    padding: 25px;
    box-shadow: 0 6px 15px rgba(0, 0, 0, 0.3);
    transition:
      transform 0.3s ease-in-out,
      border-left 0.3s ease-in-out;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    min-height: 200px; /* Consistent height */
  }

  .device-card:hover {
    transform: translateY(-8px);
  }

  .device-card.online {
    border-left: 6px solid #4caf50; /* Green */
  }

  .device-card.offline {
    border-left: 6px solid #f44336; /* Red */
  }

  .device-card.unknown {
    border-left: 6px solid #ffc107; /* Amber */
  }

  .card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 20px;
  }

  .card-header h2 {
    margin: 0;
    color: #bbe1fa; /* Light blue */
    font-size: 1.8em;
    font-weight: 500;
  }

  .status-indicator {
    padding: 7px 15px;
    border-radius: 20px;
    font-size: 0.9em;
    font-weight: bold;
    color: #fff;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .status-indicator.online {
    background-color: #4caf50;
  }

  .status-indicator.offline {
    background-color: #f44336;
  }

  .status-indicator.unknown {
    background-color: #ffc107;
  }

  .card-content p {
    margin: 10px 0;
    font-size: 1.2em;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .card-content p strong {
    color: #bbe1fa; /* Light blue */
    min-width: 90px; /* Align content */
  }
  .card-content p .value {
    color: #e0e0e0;
  }

  .card-footer {
    margin-top: 20px;
    font-size: 0.9em;
    color: #a0a0a0; /* Grey */
    text-align: right;
    border-top: 1px dashed #3a3a5a;
    padding-top: 15px;
  }

  .flipper-section {
    margin-top: 60px;
    background-color: #2b2b45;
    border-radius: 15px;
    padding: 30px;
    box-shadow: 0 8px 25px rgba(0, 0, 0, 0.4);
    border-left: 6px solid #3282b8;
  }

  .flipper-section h2 {
    color: #bbe1fa;
    margin-bottom: 25px;
    text-align: center;
    font-size: 2em;
    font-weight: 300;
  }

  .flipper-event-list {
    max-height: 450px;
    overflow-y: auto;
    border-top: 1px solid #3282b8;
    padding-top: 20px;
    scrollbar-width: thin; /* Firefox */
    scrollbar-color: #3282b8 #2b2b45; /* Firefox */
  }
  /* Chrome, Edge, Safari */
  .flipper-event-list::-webkit-scrollbar {
    width: 8px;
  }
  .flipper-event-list::-webkit-scrollbar-track {
    background: #2b2b45;
    border-radius: 10px;
  }
  .flipper-event-list::-webkit-scrollbar-thumb {
    background-color: #3282b8;
    border-radius: 10px;
    border: 2px solid #2b2b45;
  }

  .flipper-event-item {
    background-color: #1a1a2e;
    padding: 12px 18px;
    margin-bottom: 12px;
    border-radius: 10px;
    display: flex;
    flex-wrap: wrap; /* Allow items to wrap */
    justify-content: space-between;
    align-items: center;
    font-size: 0.98em;
    border-left: 4px solid #5bc0de; /* Info blue */
  }

  .flipper-event-item span {
    margin-right: 15px;
    white-space: nowrap; /* Keep parts of the event together */
  }

  .flipper-event-item .event-type {
    font-weight: bold;
    color: #5bc0de; /* Info blue */
    flex-basis: 150px; /* Give it a base width */
  }

  .flipper-event-item .device-id {
    color: #90ee90; /* Light green */
    font-style: italic;
  }

  .flipper-event-item .payload {
    flex-grow: 1;
    margin-left: 15px;
    color: #c0c0c0;
    overflow: hidden; /* Hide overflow if too long */
    text-overflow: ellipsis; /* Add ellipsis for overflow */
  }
  .flipper-event-item .payload:empty {
    display: none; /* Hide if no payload */
  }

  .flipper-event-item .timestamp {
    font-size: 0.85em;
    color: #a0a0a0;
    margin-left: auto; /* Push to the right */
  }

  /* Responsive */
  @media (max-width: 900px) {
    .cards-grid {
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
    }
    .average-card {
      flex-direction: column;
      gap: 25px;
      padding: 25px;
    }
    .average-item {
      min-width: auto;
    }
  }

  @media (max-width: 600px) {
    h1 {
      font-size: 2.2em;
    }
    .average-value {
      font-size: 2.2em;
    }
    .device-card {
      padding: 20px;
      min-height: 180px;
    }
    .card-header h2 {
      font-size: 1.5em;
    }
    .card-content p {
      font-size: 1em;
      gap: 8px;
    }
    .flipper-event-item {
      flex-direction: column;
      align-items: flex-start;
      gap: 5px;
      padding: 10px;
    }
    .flipper-event-item span {
      margin-right: 0;
      white-space: normal;
    }
    .flipper-event-item .timestamp {
      margin-left: 0;
      align-self: flex-end;
    }
    .filter-section {
      flex-direction: column;
      gap: 10px;
    }
  }
</style>
