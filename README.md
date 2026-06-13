# WiZ Smart Lighting Desktop Controller

A beautiful, locally-hosted, containerized web application to control your WiZ smart lighting system right from your desktop. 

This app communicates directly with your WiZ lights over your local Wi-Fi network using WiZ's native **local UDP protocol (port 38899)**. It features a high-fidelity, premium dark-mode interface with glassmorphism aesthetics, live onscreen lighting glow representation, individual and group controls, 24 custom scene selectors, and a Netflix-like profile management system.

---

## Features

- 🌟 **Premium UI/UX:** Stunning dark-mode dashboard with rich glassmorphism styling, responsive layouts, and soft animations.
- 💡 **Live Screen Glow:** The onscreen bulb indicator casts a real-time color glow that precisely matches the physical bulb's RGB color, Kelvin temperature, or active scene.
- ⚡ **Zero External APIs:** Everything runs locally on your machine, communicating directly with your bulbs.
- 👤 **Multi-Profile Accounts:** Netflix-style profiles screen (without passwords). Each profile maintains its own custom list of devices and saves your active session in the browser cache.
- 🎨 **RGB & Kelvin Temperature:** Smooth brightness, Kelvin white spectrum (2200K - 6500K), and custom RGB color picker controls.
- 🎭 **24 Minimalist Scenes:** Subtle scene selectors showing glowing colored indicator dots next to scene names.
- 👥 **Group Controls:** Turn all lights on/off, adjust group brightness, or set group colors simultaneously.
- 🔍 **Auto Discovery & Manual Add:** Scan your local network to find bulbs or manually add them by IP address.
- 💾 **Persistent Settings:** Saved lights and profiles persist across container restarts (stored locally in `./data/profiles.json`).
- 🤖 **CI/CD Built-in:** Automatic GitHub Action workflow compiles and pushes new builds to GitHub Container Registry (GHCR) on pushes to the main branch.

---

## Deployment & Running Guide

### Option A: Local Running (Desktop)
1. Ensure your container image is built and running in the background:
   ```bash
   docker compose up -d
   ```
2. Open your browser to: `http://localhost:8000`

### Option B: Hosting on a NAS (Synology, QNAP, Portainer)
You do not need to upload any source files or build the code on your NAS. You only need to copy the `docker-compose.yml` file to your NAS and run it.

1. **Create the docker-compose file on your NAS:**
   Create a folder `/docker/wizz_controll` on your NAS, and save the following contents as `docker-compose.yml`:
   ```yaml
   services:
     wiz-controller:
       image: ghcr.io/lenni707/wizz_controll:latest
       container_name: wiz-desktop-controller
       network_mode: host
       volumes:
         - ./data:/data
       restart: unless-stopped
   ```
   > [!NOTE]
   > - `network_mode: host` is recommended for NAS deployments to allow UDP broadcasts for auto-discovery of lights.
   > - In host network mode, port mappings are ignored; the container binds directly to port `8000` on your NAS IP.
2. **Launch the Container:**
   - **Synology Container Manager:** Create a new **Project**, point it to your folder, and click **Start**.
   - **Command Line / SSH:** Run `docker compose up -d` in the directory.
3. **Access:** Open `http://<YOUR_NAS_IP>:8000` in your browser.

---

## Updating the Application

### 1. Push changes to GitHub
The repository includes a GitHub Action ([.github/workflows/docker-publish.yml](file:///Users/lenni/programming/vibe_code/wizz_controll/.github/workflows/docker-publish.yml)) that automatically triggers when you commit and push to `main`. It will build and push the new image to `ghcr.io/lenni707/wizz_controll:latest`.
```bash
git add .
git commit -m "Your update message"
git push
```

### 2. Update on your NAS
Once the GitHub Action completes (usually 1-2 minutes), run this single command on your NAS (or click **Action > Clean/Update** in your NAS GUI) to fetch the latest code:
```bash
docker compose pull && docker compose up -d
```
All your profile settings and light databases are stored in the host volume `./data/profiles.json` and are **fully preserved** during updates.
