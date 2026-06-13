import os
import sys
import json
import socket
import asyncio
import logging
import uuid
from pathlib import Path
from typing import List, Optional, Tuple, Dict
from fastapi import FastAPI, HTTPException, Request
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pywizlight import wizlight, PilotBuilder, discovery

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("wiz-controller")

app = FastAPI(title="WiZ Desktop Controller API")

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Cache-busting middleware to prevent browsers from caching static files
@app.middleware("http")
async def add_no_cache_headers(request: Request, call_next):
    response = await call_next(request)
    path = request.url.path
    if path == "/" or path.endswith(".html") or path.endswith(".js") or path.endswith(".css"):
        response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
    return response

PROFILES_FILE = os.getenv("PROFILES_FILE", "/data/profiles.json")

# In case /data directory doesn't exist yet (e.g. running outside Docker locally)
os.makedirs(os.path.dirname(PROFILES_FILE), exist_ok=True)

def load_profiles() -> list:
    if not os.path.exists(PROFILES_FILE):
        # Default initialization
        default_profiles = [
            {
                "id": "profile_lenni",
                "name": "Lenni",
                "avatar": "indigo",
                "bulbs": []
            }
        ]
        save_profiles(default_profiles)
        return default_profiles
    try:
        with open(PROFILES_FILE, "r") as f:
            data = json.load(f)
            profiles = data.get("profiles", [])
            if not profiles:
                profiles = [
                    {
                        "id": "profile_lenni",
                        "name": "Lenni",
                        "avatar": "indigo",
                        "bulbs": []
                    }
                ]
                save_profiles(profiles)
            return profiles
    except Exception as e:
        logger.error(f"Error loading profiles: {e}")
        return []

def save_profiles(profiles: list):
    try:
        with open(PROFILES_FILE, "w") as f:
            json.dump({"profiles": profiles}, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving profiles: {e}")

# Pydantic Schemas
class ProfileAdd(BaseModel):
    name: str
    avatar: str

class ProfileRemove(BaseModel):
    id: str

class BulbControl(BaseModel):
    on: Optional[bool] = None
    brightness: Optional[int] = None
    colortemp: Optional[int] = None
    rgb: Optional[Tuple[int, int, int]] = None
    scene: Optional[int] = None
    speed: Optional[int] = None

class BulbManualAdd(BaseModel):
    ip: str
    name: str

class BulbRename(BaseModel):
    ip: str
    name: str

class BulbRemove(BaseModel):
    ip: str

# Helpers
async def get_broadcast_addresses() -> List[str]:
    ips = ["255.255.255.255"]
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        local_ip = s.getsockname()[0]
        s.close()
        
        if local_ip.startswith("192.168.") or local_ip.startswith("10.") or local_ip.startswith("172."):
            parts = local_ip.split('.')
            parts[-1] = '255'
            ips.append('.'.join(parts))
    except Exception as e:
        logger.warning(f"Failed to resolve local subnet broadcast: {e}")
    return list(set(ips))

async def fetch_light_state(ip: str, name: str) -> dict:
    try:
        light = wizlight(ip)
        state = await asyncio.wait_for(light.updateState(), timeout=2.0)
        
        is_on = state.get_state()
        brightness = state.get_brightness()
        colortemp = state.get_colortemp()
        rgb = state.get_rgb()
        scene = state.get_scene()
        
        if rgb is not None and len(rgb) == 3:
            rgb = list(rgb)
        else:
            rgb = None

        return {
            "ip": ip,
            "name": name,
            "online": True,
            "state": {
                "on": is_on,
                "brightness": brightness,
                "colortemp": colortemp,
                "rgb": rgb,
                "scene": scene
            }
        }
    except Exception as e:
        logger.debug(f"Failed to fetch state for real bulb {ip}: {e}")
        return {
            "ip": ip,
            "name": name,
            "online": False,
            "state": None,
            "error": str(e)
        }

async def send_control_to_bulb(ip: str, control: BulbControl) -> bool:
    try:
        light = wizlight(ip)
        
        if control.on is False:
            await asyncio.wait_for(light.turn_off(), timeout=2.0)
            return True
            
        pilot_params = {}
        if control.brightness is not None:
            pilot_params["brightness"] = max(0, min(255, control.brightness))
            
        if control.scene is not None:
            pilot_params["scene"] = control.scene
            if control.speed is not None:
                pilot_params["speed"] = max(10, min(200, control.speed))
        else:
            if control.rgb is not None:
                pilot_params["rgb"] = control.rgb
            elif control.colortemp is not None:
                pilot_params["colortemp"] = max(2200, min(6500, control.colortemp))
        
        builder = PilotBuilder(**pilot_params)
        await asyncio.wait_for(light.turn_on(builder), timeout=2.0)
        return True
    except Exception as e:
        logger.error(f"Failed to control real bulb {ip}: {e}")
        return False

# Profile Endpoints
@app.get("/api/profiles")
async def get_profiles():
    return load_profiles()

@app.post("/api/profiles/add")
async def add_profile(payload: ProfileAdd):
    name = payload.name.strip()
    avatar = payload.avatar.strip()
    
    if not name or not avatar:
        raise HTTPException(status_code=400, detail="Name and avatar are required")
        
    profiles = load_profiles()
    profile_id = "profile_" + str(uuid.uuid4())[:8]
    
    new_profile = {
        "id": profile_id,
        "name": name,
        "avatar": avatar,
        "bulbs": []
    }
    
    profiles.append(new_profile)
    save_profiles(profiles)
    return profiles

@app.post("/api/profiles/remove")
async def remove_profile(payload: ProfileRemove):
    profiles = load_profiles()
    # Ensure we don't delete the last profile
    if len(profiles) <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only remaining profile")
        
    updated = [p for p in profiles if p["id"] != payload.id]
    save_profiles(updated)
    return updated

# Profile-Specific Light Endpoints
@app.get("/api/profiles/{profile_id}/lights")
async def get_profile_lights(profile_id: str):
    profiles = load_profiles()
    profile = next((p for p in profiles if p["id"] == profile_id), None)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    bulbs = profile.get("bulbs", [])
    
    # Fetch all states concurrently
    tasks = [
        fetch_light_state(b["ip"], b["name"])
        for b in bulbs
    ]
    
    results = await asyncio.gather(*tasks)
    return {
        "lights": list(results)
    }

@app.post("/api/profiles/{profile_id}/lights/discover")
async def discover_profile_lights(profile_id: str):
    profiles = load_profiles()
    profile = next((p for p in profiles if p["id"] == profile_id), None)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    broadcasts = await get_broadcast_addresses()
    logger.info(f"Starting discovery on broadcast addresses: {broadcasts}")
    
    tasks = []
    for bcast in broadcasts:
        tasks.append(discovery.discover_lights(broadcast_space=bcast))
        
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    current_bulbs = profile.get("bulbs", [])
    current_ips = {b["ip"] for b in current_bulbs}
    
    new_bulbs_count = 0
    for res in results:
        if isinstance(res, list):
            for bulb in res:
                ip = bulb.ip
                if ip not in current_ips:
                    name = f"WiZ Light ({ip.split('.')[-1]})"
                    current_bulbs.append({
                        "ip": ip,
                        "name": name
                    })
                    current_ips.add(ip)
                    new_bulbs_count += 1
                    
    profile["bulbs"] = current_bulbs
    save_profiles(profiles)
    
    # Query states
    tasks = [
        fetch_light_state(b["ip"], b["name"])
        for b in current_bulbs
    ]
    updated_lights = await asyncio.gather(*tasks)
    
    return {
        "status": "success",
        "new_bulbs_found": new_bulbs_count,
        "total_bulbs": len(current_bulbs),
        "lights": list(updated_lights)
    }

@app.post("/api/profiles/{profile_id}/lights/add")
async def add_profile_light(profile_id: str, payload: BulbManualAdd):
    ip = payload.ip.strip()
    name = payload.name.strip()
    
    if not ip or not name:
        raise HTTPException(status_code=400, detail="IP address and Name are required")
        
    profiles = load_profiles()
    profile = next((p for p in profiles if p["id"] == profile_id), None)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    current_bulbs = profile.get("bulbs", [])
    
    for b in current_bulbs:
        if b["ip"] == ip:
            raise HTTPException(status_code=400, detail="Bulb with this IP already exists")
            
    current_bulbs.append({
        "ip": ip,
        "name": name
    })
    save_profiles(profiles)
    
    # Fetch status of new bulb list
    tasks = [
        fetch_light_state(b["ip"], b["name"])
        for b in current_bulbs
    ]
    updated_lights = await asyncio.gather(*tasks)
    
    return {
        "status": "success",
        "lights": list(updated_lights)
    }

@app.post("/api/profiles/{profile_id}/lights/remove")
async def remove_profile_light(profile_id: str, payload: BulbRemove):
    profiles = load_profiles()
    profile = next((p for p in profiles if p["id"] == profile_id), None)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    current_bulbs = profile.get("bulbs", [])
    updated_bulbs = [b for b in current_bulbs if b["ip"] != payload.ip]
    profile["bulbs"] = updated_bulbs
    
    save_profiles(profiles)
    
    # Fetch status
    tasks = [
        fetch_light_state(b["ip"], b["name"])
        for b in updated_bulbs
    ]
    updated_lights = await asyncio.gather(*tasks)
    
    return {
        "status": "success",
        "lights": list(updated_lights)
    }

@app.post("/api/profiles/{profile_id}/lights/rename")
async def rename_profile_light(profile_id: str, payload: BulbRename):
    profiles = load_profiles()
    profile = next((p for p in profiles if p["id"] == profile_id), None)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    current_bulbs = profile.get("bulbs", [])
    found = False
    for b in current_bulbs:
        if b["ip"] == payload.ip:
            b["name"] = payload.name.strip()
            found = True
            break
            
    if not found:
        raise HTTPException(status_code=404, detail="Bulb not found")
        
    save_profiles(profiles)
    
    # Fetch status
    tasks = [
        fetch_light_state(b["ip"], b["name"])
        for b in current_bulbs
    ]
    updated_lights = await asyncio.gather(*tasks)
    
    return {
        "status": "success",
        "lights": list(updated_lights)
    }

@app.post("/api/profiles/{profile_id}/lights/{ip}/control")
async def control_profile_light(profile_id: str, ip: str, control: BulbControl):
    profiles = load_profiles()
    profile = next((p for p in profiles if p["id"] == profile_id), None)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    bulbs = profile.get("bulbs", [])
    target_bulb = next((b for b in bulbs if b["ip"] == ip), None)
    
    if not target_bulb:
        raise HTTPException(status_code=404, detail="Bulb not found in this profile configuration")
        
    success = await send_control_to_bulb(ip, control)
    if not success:
        raise HTTPException(status_code=502, detail="Failed to communicate with the light")
        
    updated_state = await fetch_light_state(ip, target_bulb["name"])
    return {
        "status": "success",
        "light": updated_state
    }

@app.post("/api/profiles/{profile_id}/lights/group/control")
async def control_profile_group(profile_id: str, control: BulbControl):
    profiles = load_profiles()
    profile = next((p for p in profiles if p["id"] == profile_id), None)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
        
    bulbs = profile.get("bulbs", [])
    if not bulbs:
        return {"status": "success", "lights": []}
        
    # Control all concurrently
    tasks = [
        send_control_to_bulb(b["ip"], control)
        for b in bulbs
    ]
    results = await asyncio.gather(*tasks)
    
    # Query updated states
    state_tasks = [
        fetch_light_state(b["ip"], b["name"])
        for b in bulbs
    ]
    updated_lights = await asyncio.gather(*state_tasks)
    
    success_count = sum(1 for r in results if r)
    return {
        "status": "success",
        "success_count": success_count,
        "total_count": len(bulbs),
        "lights": list(updated_lights)
    }

# Resolve static files path for PyInstaller or native running
BASE_DIR = Path(__file__).resolve().parent
if getattr(sys, 'frozen', False):
    STATIC_DIR = Path(sys._MEIPASS) / "app" / "static"
else:
    STATIC_DIR = BASE_DIR / "static"

app.mount("/", StaticFiles(directory=str(STATIC_DIR), html=True), name="static")
