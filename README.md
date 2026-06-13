# WiZ Smart Lighting Desktop Controller

A beautiful, locally-hosted, containerized web application to control your WiZ smart lighting system right from your desktop. 

This app communicates directly with your WiZ lights over your local Wi-Fi network using WiZ's native **local UDP protocol (port 38899)**. It features a high-fidelity, premium dark-mode interface with glassmorphism aesthetics, live onscreen lighting glow representation, individual and group controls, and 24 custom-designed scene selectors.

---

## Features

- 🌟 **Premium UI/UX:** Stunning dark-mode dashboard with rich glassmorphism styling, responsive layouts, and soft animations.
- 💡 **Live Screen Glow:** The onscreen bulb indicator casts a real-time color glow that precisely matches the physical bulb's RGB color, Kelvin temperature, or active scene.
- ⚡ **Zero External APIs:** Everything runs locally on your machine, communicating directly with your bulbs.
- 🎨 **RGB & Kelvin Temperature:** Smooth brightness, Kelvin white spectrum (2200K - 6500K), and custom RGB color picker controls.
- 🎭 **24 Predefined Scenes:** Instant triggers for popular WiZ scenes (Sunset, Ocean, Party, Fireplace, Cozy, Forest, etc.) with custom gradients.
- 👥 **Group Controls:** Turn all lights on/off, adjust group brightness, or set group colors simultaneously.
- 🔍 **Auto Discovery & Manual Add:** Scan your local network to find bulbs or manually add them by IP address.
- 💾 **Persistent Settings:** Saved lights persist across container restarts (stored locally in `./data/bulbs.json`).

---

## Quick Start

### 1. Build and Run Container
Run the following command in your terminal inside this directory to build and start the container in the background:
```bash
docker compose up --build -d
```

### 2. Access the Web Interface
Once running, open your web browser and navigate to:
```url
http://localhost:8000
```

---

## Operating Instructions & Networking Tips

### Finding Your Bulb's IP Address
Since WiZ bulbs communicate via local UDP unicast, the controller needs to know their IP addresses:
1. Open the **WiZ Mobile App**.
2. Tap on the room, then tap on the **bulb/light** you want to control.
3. Tap the **Settings (Gear)** or the **Info ("i")** icon.
4. Note down the **IP Address** (e.g., `192.168.1.104`).
5. *(Recommended)* Set a **DHCP Reservation (Static IP)** in your router settings for your bulbs so their IP addresses do not change.

### Automatic Discovery vs. Manual Add
- **Scan Local Network:** Clicking the scan button sends a UDP broadcast to discover bulbs. Note that Docker Desktop (especially on macOS and Windows) runs inside a virtual machine, which occasionally blocks UDP broadcasts from escaping to the physical network.
- **Add IP Manually:** If the scanner does not find your bulbs automatically, simply click **Add IP**, input the IP address you found in your WiZ mobile app, and give it a custom name. Once added, the container sends unicast UDP packets directly to the bulb, which bypasses VM broadcast limits and works **100% reliably on all operating systems**.

---

## Project Structure

```text
wizz_controll/
├── app/
│   ├── main.py          # FastAPI backend (UDP client & API endpoints)
│   └── static/          # Web frontend files
│       ├── index.html   # Main Dashboard
│       ├── css/
│       │   └── style.css# Premium styling stylesheet
│       └── js/
│           └── app.js   # Frontend state and event binding
├── Dockerfile           # Multi-stage python container build
├── docker-compose.yml   # Port and volume mapping
├── requirements.txt     # Python dependencies
└── README.md            # Documentation
```

---

## Stop the Application
To stop and remove the container:
```bash
docker compose down
```
All bulb settings are saved in the host directory `./data/bulbs.json` and will load automatically when you restart.
