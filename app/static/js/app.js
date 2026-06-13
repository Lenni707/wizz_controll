// WiZ Smart Desktop Controller App Logic

// App State
let profiles = [];
let activeProfileId = null;
let lights = [];
let activeLightIp = null;
let isDiscovering = false;
let isManageMode = false;

// DOM Elements
const profileSelectionScreen = document.getElementById('profile-selection-screen');
const profilesGrid = document.getElementById('profiles-grid');
const btnAddProfileModal = document.getElementById('btn-add-profile-modal');
const btnManageProfiles = document.getElementById('btn-manage-profiles');
const appContainer = document.querySelector('.app-container');

// Header elements
const statsCount = document.getElementById('stats-count');
const btnActiveProfile = document.getElementById('btn-active-profile');
const activeProfileName = document.getElementById('active-profile-name');
const activeProfileAvatarColor = document.getElementById('active-profile-avatar-color');

// Dashboard elements
const lightsListContainer = document.getElementById('lights-list-container');
const activeControlsContainer = document.getElementById('active-controls-container');
const noSelectionState = document.getElementById('no-selection-state');
const btnDiscover = document.getElementById('btn-discover');
const btnHome = document.getElementById('btn-home');

// Active Light Control Inputs
const activeLightName = document.getElementById('active-light-name');
const activeLightIpLabel = document.getElementById('active-light-ip');
const activePowerBtn = document.getElementById('active-power-btn');
const bulbGlowIndicator = document.getElementById('bulb-glow-indicator');
const inputBrightness = document.getElementById('input-brightness');
const valBrightness = document.getElementById('val-brightness');
const inputColortemp = document.getElementById('input-colortemp');
const valColortemp = document.getElementById('val-colortemp');
const cardColortemp = document.getElementById('card-colortemp');
const inputColorPicker = document.getElementById('input-color-picker');
const valColorHex = document.getElementById('val-color-hex');

// Modals
const modalAddDevice = document.getElementById('modal-add-device');
const modalRenameDevice = document.getElementById('modal-rename-device');
const modalAddProfile = document.getElementById('modal-add-profile');
const btnAddModal = document.getElementById('btn-add-modal');
const btnRenameModal = document.getElementById('btn-rename-modal');
const btnRemoveLight = document.getElementById('btn-remove-light');

// Scene Color Mapping for Onscreen Glow representation
const SCENE_COLORS = {
    1: [0, 198, 255],     // Ocean
    2: [248, 87, 166],    // Romance
    3: [241, 39, 17],     // Sunset
    4: [138, 35, 135],    // Party
    5: [211, 16, 39],     // Fireplace
    6: [247, 183, 51],    // Cozy
    7: [17, 153, 142],    // Forest
    8: [224, 195, 252],   // Pastel
    9: [224, 234, 252],   // Wake-up
    10: [15, 32, 39],     // Bedtime
    11: [255, 180, 100],  // Warm White (approx 2700K)
    12: [255, 255, 255],  // Daylight
    13: [224, 242, 254],  // Cool White
    14: [13, 27, 42],     // Night Light
    15: [86, 204, 242],   // Focus
    16: [140, 166, 219],  // Relax
    18: [15, 12, 32],     // TV Time
    26: [123, 31, 162],   // Club Glow
    27: [211, 47, 47],    // Christmas
    28: [255, 126, 0],    // Halloween
    29: [255, 224, 102],  // Candlelight
    30: [243, 156, 18],   // Golden White
    32: [92, 44, 22],     // Steampunk
    33: [255, 69, 0]      // Diwali
};

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
    initProfiles();
    setupEventListeners();
});

// Setup Event Listeners
function setupEventListeners() {
    // Discovery
    btnDiscover.addEventListener('click', discoverLights);

    // Home Button
    btnHome.addEventListener('click', deselectLight);

    // Profile Screen Buttons
    btnAddProfileModal.addEventListener('click', () => openModal(modalAddProfile));
    btnManageProfiles.addEventListener('click', toggleManageProfilesMode);
    
    // Header Profile Switcher
    btnActiveProfile.addEventListener('click', () => {
        deselectLight();
        showProfileScreen();
    });

    // Modals open/close
    btnAddModal.addEventListener('click', () => openModal(modalAddDevice));
    btnRenameModal.addEventListener('click', () => {
        const activeLight = lights.find(l => l.ip === activeLightIp);
        if (activeLight) {
            document.getElementById('rename-name').value = activeLight.name;
            openModal(modalRenameDevice);
        }
    });

    document.querySelectorAll('.btn-close-modal').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });

    // Modal forms submission
    document.getElementById('form-add-device').addEventListener('submit', handleAddDevice);
    document.getElementById('form-rename-device').addEventListener('submit', handleRenameDevice);
    document.getElementById('form-add-profile').addEventListener('submit', handleAddProfile);

    // Remove Light
    btnRemoveLight.addEventListener('click', handleRemoveLight);

    // Active Bulb Controls
    activePowerBtn.addEventListener('click', togglePower);

    // Sliders: Instant UI feedback (input) + Server update on release (change)
    inputBrightness.addEventListener('input', (e) => {
        const val = e.target.value;
        const pct = Math.round((val / 255) * 100);
        valBrightness.textContent = `${pct}%`;
        document.documentElement.style.setProperty('--bulb-brightness', val / 255);
    });
    inputBrightness.addEventListener('change', (e) => {
        sendControl({ brightness: parseInt(e.target.value) });
    });

    inputColortemp.addEventListener('input', (e) => {
        const val = e.target.value;
        valColortemp.textContent = `${val} K`;
        const rgb = kelvinToRgb(parseInt(val));
        updateBulbColorGlow(rgb.r, rgb.g, rgb.b);
    });
    inputColortemp.addEventListener('change', (e) => {
        sendControl({ colortemp: parseInt(e.target.value) });
    });

    // Color Swatches
    document.querySelectorAll('.color-swatch').forEach(swatch => {
        swatch.addEventListener('click', () => {
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
            swatch.classList.add('active');

            if (swatch.dataset.rgb) {
                const rgb = swatch.dataset.rgb.split(',').map(Number);
                sendControl({ rgb: rgb });
                updateBulbColorGlow(rgb[0], rgb[1], rgb[2]);
                const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
                inputColorPicker.value = hex;
                valColorHex.textContent = hex.toUpperCase();
            } else if (swatch.dataset.kelvin) {
                const kelvin = parseInt(swatch.dataset.kelvin);
                sendControl({ colortemp: kelvin });
                const rgb = kelvinToRgb(kelvin);
                updateBulbColorGlow(rgb.r, rgb.g, rgb.b);
                inputColortemp.value = kelvin;
                valColortemp.textContent = `${kelvin} K`;
            }
        });
    });

    // Custom Color Picker
    inputColorPicker.addEventListener('input', (e) => {
        const hex = e.target.value;
        valColorHex.textContent = hex.toUpperCase();
        const rgb = hexToRgb(hex);
        if (rgb) {
            updateBulbColorGlow(rgb.r, rgb.g, rgb.b);
        }
    });
    inputColorPicker.addEventListener('change', (e) => {
        const rgb = hexToRgb(e.target.value);
        if (rgb) {
            sendControl({ rgb: [rgb.r, rgb.g, rgb.b] });
        }
    });

    // Scene Cards
    document.querySelectorAll('.scene-card').forEach(card => {
        card.addEventListener('click', () => {
            const sceneId = parseInt(card.dataset.scene);
            document.querySelectorAll('.scene-card').forEach(c => c.classList.remove('active'));
            card.classList.add('active');
            
            sendControl({ scene: sceneId });
            
            const scColor = SCENE_COLORS[sceneId] || [255, 255, 255];
            updateBulbColorGlow(scColor[0], scColor[1], scColor[2]);
        });
    });

    // Group Controls
    document.getElementById('group-on').addEventListener('click', () => sendGroupControl({ on: true }));
    document.getElementById('group-off').addEventListener('click', () => sendGroupControl({ on: false }));
    document.getElementById('group-brightness').addEventListener('change', (e) => {
        sendGroupControl({ brightness: parseInt(e.target.value) });
    });
}

// ----------------------------------------------------
// PROFILE LOGIC
// ----------------------------------------------------

async function initProfiles() {
    try {
        const response = await fetch('/api/profiles');
        profiles = await response.json();
        
        renderProfilesGrid();
        
        // Check local storage for saved session profile
        const savedProfileId = localStorage.getItem('activeProfileId');
        if (savedProfileId && profiles.some(p => p.id === savedProfileId)) {
            selectProfile(savedProfileId);
        } else {
            showProfileScreen();
        }
    } catch (err) {
        console.error("Error loading profiles:", err);
    }
}

function showProfileScreen() {
    activeProfileId = null;
    isManageMode = false;
    btnManageProfiles.textContent = "Manage Profiles";
    
    appContainer.style.display = "none";
    profileSelectionScreen.classList.add('active');
    
    renderProfilesGrid();
}

function renderProfilesGrid() {
    profilesGrid.innerHTML = '';
    
    profiles.forEach(profile => {
        const card = document.createElement('div');
        card.className = `profile-card ${isManageMode ? 'manageable' : ''}`;
        
        const initial = profile.name.charAt(0).toUpperCase();
        
        card.innerHTML = `
            <div class="profile-avatar-box color-${profile.avatar}">
                ${initial}
            </div>
            <div class="profile-avatar-name">${profile.name}</div>
            <button class="profile-delete-btn" data-id="${profile.id}" title="Delete profile">&times;</button>
        `;
        
        // Click to enter profile
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('profile-delete-btn')) return;
            
            if (isManageMode) {
                // Future extension: Edit name
                const newName = prompt(`Change profile name for "${profile.name}":`, profile.name);
                if (newName && newName.trim()) {
                    renameProfile(profile.id, newName.trim());
                }
            } else {
                selectProfile(profile.id);
            }
        });
        
        // Delete button listener
        const delBtn = card.querySelector('.profile-delete-btn');
        delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            deleteProfile(profile.id, profile.name);
        });
        
        profilesGrid.appendChild(card);
    });
}

function toggleManageProfilesMode() {
    isManageMode = !isManageMode;
    btnManageProfiles.textContent = isManageMode ? "Done" : "Manage Profiles";
    renderProfilesGrid();
}

async function selectProfile(profileId) {
    const profile = profiles.find(p => p.id === profileId);
    if (!profile) return;
    
    activeProfileId = profileId;
    localStorage.setItem('activeProfileId', profileId);
    
    // Set Header profile labels
    activeProfileName.textContent = profile.name;
    // Set color class
    activeProfileAvatarColor.className = `profile-dot-header color-${profile.avatar}`;
    
    // Hide overlay & show workspace
    profileSelectionScreen.classList.remove('active');
    appContainer.style.display = "flex";
    
    // Fetch Lights
    await fetchLights();
    deselectLight();
}

async function handleAddProfile(e) {
    e.preventDefault();
    const nameInput = document.getElementById('new-profile-name');
    const avatarInput = document.querySelector('input[name="profile-avatar"]:checked');
    
    if (!nameInput.value.trim()) return;
    
    try {
        const response = await fetch('/api/profiles/add', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: nameInput.value.trim(),
                avatar: avatarInput.value
            })
        });
        
        if (response.ok) {
            profiles = await response.json();
            renderProfilesGrid();
            closeAllModals();
            
            nameInput.value = '';
        }
    } catch (err) {
        console.error("Error adding profile:", err);
    }
}

async function deleteProfile(profileId, name) {
    if (profiles.length <= 1) {
        alert("You must keep at least one profile.");
        return;
    }
    
    if (confirm(`Are you sure you want to delete profile "${name}"? All associated lights will be removed.`)) {
        try {
            const response = await fetch('/api/profiles/remove', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id: profileId })
            });
            
            if (response.ok) {
                profiles = await response.json();
                renderProfilesGrid();
                
                // If deleted active profile, log out
                if (activeProfileId === profileId) {
                    localStorage.removeItem('activeProfileId');
                    showProfileScreen();
                }
            } else {
                const data = await response.json();
                alert(data.detail || "Failed to remove profile.");
            }
        } catch (err) {
            console.error("Error deleting profile:", err);
        }
    }
}

async function renameProfile(profileId, newName) {
    // Currently, let's keep it simple: we can map rename in backend, 
    // or just let it edit names in local memory (simulating changes, 
    // or we can implement it as a nice feature if requested, but for now we skip backend additions and edit names local, 
    // actually, let's keep it simple: edit profile is optional, let's just make it edit name in local config if backend had it, 
    // but the backend does not have rename profile. Let's just focus on adding/removing profiles which is what user requested.)
}

// ----------------------------------------------------
// LIGHTS LOGIC
// ----------------------------------------------------

// Fetch lights from server
async function fetchLights() {
    if (!activeProfileId) return;
    try {
        const response = await fetch(`/api/profiles/${activeProfileId}/lights`);
        const data = await response.json();
        lights = data.lights || [];
        
        updateStats();
        renderLightsList();
        
        if (activeLightIp) {
            const currentSelected = lights.find(l => l.ip === activeLightIp);
            if (currentSelected) {
                updateActiveControlsUI(currentSelected);
            } else {
                deselectLight();
            }
        }
    } catch (err) {
        console.error('Error fetching lights:', err);
    }
}

// Start discovery scan
async function discoverLights() {
    if (!activeProfileId || isDiscovering) return;
    
    isDiscovering = true;
    btnDiscover.classList.add('disabled');
    const refreshIcon = btnDiscover.querySelector('.icon-refresh');
    refreshIcon.classList.add('spinning');
    
    lightsListContainer.innerHTML = `
        <div class="loading-state">
            <div class="spinner"></div>
            <p>Scanning local network for WiZ lights...</p>
        </div>
    `;

    try {
        const response = await fetch(`/api/profiles/${activeProfileId}/lights/discover`, { method: 'POST' });
        const data = await response.json();
        
        lights = data.lights || [];
        
        updateStats();
        renderLightsList();
        deselectLight();
        
        console.log(`Discovery complete. Found ${data.new_bulbs_found} new lights.`);
    } catch (err) {
        console.error('Error during discovery:', err);
        renderLightsList();
    } finally {
        isDiscovering = false;
        btnDiscover.classList.remove('disabled');
        refreshIcon.classList.remove('spinning');
    }
}

// Render the device list on left panel
function renderLightsList() {
    lightsListContainer.innerHTML = '';
    
    if (lights.length === 0) {
        lightsListContainer.innerHTML = `
            <div class="empty-state">
                <p>No bulbs found.</p>
                <p style="font-size: 11px; margin-top: 8px;">Run "Scan Local Network" or manually add a bulb's IP address.</p>
            </div>
        `;
        return;
    }
    
    lights.forEach(light => {
        const card = document.createElement('div');
        card.className = `light-card ${light.state?.on ? 'on' : ''} ${!light.online ? 'offline' : ''} ${light.ip === activeLightIp ? 'active' : ''}`;
        
        let swatchColor = 'transparent';
        let glowStyle = '';
        if (light.online && light.state?.on) {
            let rgb = [255, 200, 100]; // default warm
            if (light.state.rgb) {
                rgb = light.state.rgb;
            } else if (light.state.colortemp) {
                const computed = kelvinToRgb(light.state.colortemp);
                rgb = [computed.r, computed.g, computed.b];
            } else if (light.state.scene && SCENE_COLORS[light.state.scene]) {
                rgb = SCENE_COLORS[light.state.scene];
            }
            swatchColor = `rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`;
            glowStyle = `style="--bulb-glow: rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, 0.35);"`;
        }

        const bulbIconSvg = `
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
                <path d="M12 2C8.13 2 5 5.13 5 9c0 2.38 1.19 4.47 3 5.74V17c0 .55.45 1 1 1h6c.55 0 1-.45 1-1v-2.26c1.81-1.27 3-3.36 3-5.74 0-3.87-3.13-7-7-7zm2.85 11.1l-.85.6V16h-4v-2.3l-.85-.6C7.8 12.16 7 10.65 7 9c0-2.76 2.24-5 5-5s5 2.24 5 5c0 1.65-.8 3.16-2.15 4.1zM9 19h6v1H9v-1zm1 2h4v1h-4v-1z"/>
            </svg>
        `;

        card.innerHTML = `
            <div class="light-info">
                <div class="light-icon-wrapper" ${glowStyle}>
                    ${bulbIconSvg}
                </div>
                <div class="light-details">
                    <h4>${light.name}</h4>
                    <div class="light-status-row">
                        <span class="status-indicator ${light.online ? 'online' : 'offline'}"></span>
                        <span>${light.online ? (light.state?.on ? 'On' : 'Off') : 'Offline'}</span>
                        <span class="divider">•</span>
                        <span>${light.ip}</span>
                    </div>
                </div>
            </div>
            <button class="btn-text toggle-switch-trigger" data-ip="${light.ip}"></button>
        `;
        
        card.addEventListener('click', (e) => {
            if (e.target.classList.contains('toggle-switch-trigger')) return;
            selectLight(light.ip);
        });

        const quickToggle = card.querySelector('.toggle-switch-trigger');
        if (light.online) {
            quickToggle.addEventListener('click', (e) => {
                e.stopPropagation();
                togglePowerForIp(light.ip, !light.state?.on);
            });
        }
        
        lightsListContainer.appendChild(card);
    });
}

// Select a light for detail view
function selectLight(ip) {
    activeLightIp = ip;
    const selected = lights.find(l => l.ip === ip);
    
    document.querySelectorAll('.light-card').forEach(card => card.classList.remove('active'));
    
    const cards = lightsListContainer.querySelectorAll('.light-card');
    lights.forEach((l, index) => {
        if (l.ip === ip && cards[index]) {
            cards[index].classList.add('active');
        }
    });

    if (selected) {
        updateActiveControlsUI(selected);
        noSelectionState.style.display = 'none';
        activeControlsContainer.style.display = 'flex';
    }
}

// Deselect active light
function deselectLight() {
    activeLightIp = null;
    noSelectionState.style.display = 'flex';
    activeControlsContainer.style.display = 'none';
    
    document.querySelectorAll('.light-card').forEach(card => card.classList.remove('active'));
}

// Update Active Detail panel
function updateActiveControlsUI(light) {
    activeLightName.textContent = light.name;
    activeLightIpLabel.textContent = light.ip;
    
    if (light.state?.on) {
        activePowerBtn.classList.add('on');
    } else {
        activePowerBtn.classList.remove('on');
    }

    if (!light.online) {
        activeControlsContainer.style.opacity = '0.5';
        activeControlsContainer.style.pointerEvents = 'none';
        return;
    } else {
        activeControlsContainer.style.opacity = '1';
        activeControlsContainer.style.pointerEvents = 'all';
    }

    const br = light.state?.brightness !== undefined ? light.state.brightness : 255;
    inputBrightness.value = br;
    valBrightness.textContent = `${Math.round((br / 255) * 100)}%`;
    document.documentElement.style.setProperty('--bulb-brightness', br / 255);

    let glowRgb = [255, 180, 100];
    
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.scene-card').forEach(c => c.classList.remove('active'));

    if (light.state?.scene) {
        const sceneId = light.state.scene;
        const matchingScene = activeControlsContainer.querySelector(`.scene-card[data-scene="${sceneId}"]`);
        if (matchingScene) {
            matchingScene.classList.add('active');
        }
        cardColortemp.style.opacity = '0.4';
        
        if (SCENE_COLORS[sceneId]) {
            glowRgb = SCENE_COLORS[sceneId];
        }
    } else if (light.state?.rgb) {
        const rgb = light.state.rgb;
        glowRgb = rgb;
        cardColortemp.style.opacity = '0.4';
        
        const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
        inputColorPicker.value = hex;
        valColorHex.textContent = hex.toUpperCase();

        const matchingSwatch = Array.from(document.querySelectorAll('.color-swatch')).find(s => s.dataset.rgb === `${rgb[0]},${rgb[1]},${rgb[2]}`);
        if (matchingSwatch) matchingSwatch.classList.add('active');
    } else if (light.state?.colortemp) {
        cardColortemp.style.opacity = '1';
        const temp = light.state.colortemp;
        inputColortemp.value = temp;
        valColortemp.textContent = `${temp} K`;
        
        const rgb = kelvinToRgb(temp);
        glowRgb = [rgb.r, rgb.g, rgb.b];

        const matchingSwatch = Array.from(document.querySelectorAll('.color-swatch')).find(s => parseInt(s.dataset.kelvin) === temp);
        if (matchingSwatch) matchingSwatch.classList.add('active');
    }

    if (light.state?.on) {
        updateBulbColorGlow(glowRgb[0], glowRgb[1], glowRgb[2]);
    } else {
        updateBulbColorGlow(32, 39, 60, true);
    }
}

// Send light control parameters to backend
async function sendControl(payload) {
    if (!activeProfileId || !activeLightIp) return;
    
    try {
        const response = await fetch(`/api/profiles/${activeProfileId}/lights/${activeLightIp}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        
        const data = await response.json();
        
        if (data.status === 'success') {
            const index = lights.findIndex(l => l.ip === activeLightIp);
            if (index !== -1) {
                lights[index] = data.light;
                updateStats();
                renderLightsList();
            }
        }
    } catch (err) {
        console.error('Error sending control:', err);
    }
}

// Toggle power status
function togglePower() {
    const activeLight = lights.find(l => l.ip === activeLightIp);
    if (!activeLight) return;
    
    const nextState = !activeLight.state?.on;
    
    if (nextState) {
        activePowerBtn.classList.add('on');
    } else {
        activePowerBtn.classList.remove('on');
    }
    
    sendControl({ on: nextState });
}

// Toggle power status directly from the list card
async function togglePowerForIp(ip, nextState) {
    if (!activeProfileId) return;
    try {
        const response = await fetch(`/api/profiles/${activeProfileId}/lights/${ip}/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ on: nextState })
        });
        
        const data = await response.json();
        if (data.status === 'success') {
            const index = lights.findIndex(l => l.ip === ip);
            if (index !== -1) {
                lights[index] = data.light;
                updateStats();
                renderLightsList();
                
                if (activeLightIp === ip) {
                    updateActiveControlsUI(data.light);
                }
            }
        }
    } catch (err) {
        console.error('Error toggling power:', err);
    }
}

// Send Group Control commands
async function sendGroupControl(payload) {
    if (!activeProfileId) return;
    try {
        const response = await fetch(`/api/profiles/${activeProfileId}/lights/group/control`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const data = await response.json();
        if (data.status === 'success') {
            lights = data.lights || [];
            updateStats();
            renderLightsList();
        }
    } catch (err) {
        console.error('Error sending group control:', err);
    }
}

// Apply Group color
window.applyGroupColor = function(r, g, b) {
    sendGroupControl({ rgb: [r, g, b] });
};

// Apply Group Kelvin
window.applyGroupKelvin = function(kelvin) {
    sendGroupControl({ colortemp: kelvin });
};

// Manual Device Addition
async function handleAddDevice(e) {
    e.preventDefault();
    if (!activeProfileId) return;
    
    const ipInput = document.getElementById('add-ip');
    const nameInput = document.getElementById('add-name');
    const errorDiv = document.getElementById('add-error');
    
    errorDiv.style.display = 'none';
    
    try {
        const response = await fetch(`/api/profiles/${activeProfileId}/lights/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip: ipInput.value.trim(),
                name: nameInput.value.trim()
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            lights = data.lights || [];
            updateStats();
            renderLightsList();
            closeAllModals();
            
            selectLight(ipInput.value.trim());
            
            ipInput.value = '';
            nameInput.value = '';
        } else {
            errorDiv.textContent = data.detail || 'Failed to add device.';
            errorDiv.style.display = 'block';
        }
    } catch (err) {
        errorDiv.textContent = 'Server communication error.';
        errorDiv.style.display = 'block';
    }
}

// Rename Device
async function handleRenameDevice(e) {
    e.preventDefault();
    if (!activeProfileId || !activeLightIp) return;
    
    const nameInput = document.getElementById('rename-name');
    
    try {
        const response = await fetch(`/api/profiles/${activeProfileId}/lights/rename`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                ip: activeLightIp,
                name: nameInput.value.trim()
            })
        });
        
        const data = await response.json();
        
        if (response.ok) {
            lights = data.lights || [];
            updateStats();
            renderLightsList();
            closeAllModals();
            
            const updated = lights.find(l => l.ip === activeLightIp);
            if (updated) {
                updateActiveControlsUI(updated);
            }
        }
    } catch (err) {
        console.error('Error renaming bulb:', err);
    }
}

// Remove Device
async function handleRemoveLight() {
    if (!activeProfileId || !activeLightIp) return;
    
    const selected = lights.find(l => l.ip === activeLightIp);
    if (!selected) return;
    
    if (confirm(`Are you sure you want to remove "${selected.name}" from your desktop panel?`)) {
        try {
            const response = await fetch(`/api/profiles/${activeProfileId}/lights/remove`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ip: activeLightIp })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                lights = data.lights || [];
                updateStats();
                renderLightsList();
                deselectLight();
            }
        } catch (err) {
            console.error('Error removing bulb:', err);
        }
    }
}

// Stats update
function updateStats() {
    const count = lights.length;
    statsCount.textContent = `${count} Light${count === 1 ? '' : 's'}`;
}

// CSS Variable Glow Updates
function updateBulbColorGlow(r, g, b, isOff = false) {
    if (isOff) {
        document.documentElement.style.setProperty('--bulb-color', 'rgb(30, 41, 59)');
        document.documentElement.style.setProperty('--bulb-glow', 'rgba(30, 41, 59, 0)');
    } else {
        document.documentElement.style.setProperty('--bulb-color', `rgb(${r}, ${g}, ${b})`);
        document.documentElement.style.setProperty('--bulb-glow', `rgba(${r}, ${g}, ${b}, 0.55)`);
    }
}

// Modals management
function openModal(modal) {
    modal.classList.add('active');
}

function closeAllModals() {
    modalAddDevice.classList.remove('active');
    modalRenameDevice.classList.remove('active');
    modalAddProfile.classList.remove('active');
    document.getElementById('add-error').style.display = 'none';
}

// Color Utility Helpers
function kelvinToRgb(kelvin) {
    let temp = kelvin / 100;
    let red, green, blue;

    if (temp <= 66) {
        red = 255;
        green = temp;
        green = 99.4708025861 * Math.log(green) - 161.1195681661;
        
        if (temp <= 19) {
            blue = 0;
        } else {
            blue = temp - 10;
            blue = 138.5177312231 * Math.log(blue) - 305.0447927307;
        }
    } else {
        red = temp - 60;
        red = 329.698727446 * Math.pow(red, -0.1332047592);
        
        green = temp - 60;
        green = 288.1221695283 * Math.pow(green, -0.0755148492);
        
        blue = 255;
    }

    return {
        r: Math.max(0, Math.min(255, Math.round(red))),
        g: Math.max(0, Math.min(255, Math.round(green))),
        b: Math.max(0, Math.min(255, Math.round(blue)))
    };
}

function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}
