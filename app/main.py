import os
import json
import socket
import asyncio
import logging
from typing import List, Optional, Tuple
from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from pywizlight import wizlight, PilotBuilder, discovery

from fastapi import FastAPI, HTTPException, Request

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

BULBS_FILE = os.getenv("BULBS_FILE", "bulbs.json")

def load_bulbs() -> list:
    if not os.path.exists(BULBS_FILE):
        return []
    try:
        with open(BULBS_FILE, "r") as f:
            data = json.load(f)
            return data.get("bulbs", [])
    except Exception as e:
        logger.error(f"Error loading bulbs: {e}")
        return []

def save_bulbs(bulbs: list):
    try:
        with open(BULBS_FILE, "w") as f:
            json.dump({"bulbs": bulbs}, f, indent=2)
    except Exception as e:
        logger.error(f"Error saving bulbs: {e}")

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
            
        # Build commands
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

# Endpoints
@app.get("/api/lights")
async def get_lights():
    bulbs = load_bulbs()
    
    # Fetch all states concurrently
    tasks = [
        fetch_light_state(b["ip"], b["name"])
        for b in bulbs
    ]
    
    results = await asyncio.gather(*tasks)
    return {
        "lights": list(results)
    }

@app.post("/api/lights/discover")
async def discover_lights_endpoint():
    broadcasts = await get_broadcast_addresses()
    logger.info(f"Starting discovery on broadcast addresses: {broadcasts}")
    
    tasks = []
    for bcast in broadcasts:
        tasks.append(discovery.discover_lights(broadcast_space=bcast))
        
    results = await asyncio.gather(*tasks, return_exceptions=True)
    
    current_bulbs = load_bulbs()
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
                    
    # Save the updated configuration
    save_bulbs(current_bulbs)
    
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

@app.post("/api/lights/add")
async def add_light(payload: BulbManualAdd):
    ip = payload.ip.strip()
    name = payload.name.strip()
    
    if not ip or not name:
        raise HTTPException(status_code=400, detail="IP address and Name are required")
        
    current_bulbs = load_bulbs()
        
    # Check if duplicate IP
    for b in current_bulbs:
        if b["ip"] == ip:
            raise HTTPException(status_code=400, detail="Bulb with this IP already exists")
            
    current_bulbs.append({
        "ip": ip,
        "name": name
    })
    save_bulbs(current_bulbs)
    
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

@app.post("/api/lights/remove")
async def remove_light(payload: BulbRemove):
    current_bulbs = load_bulbs()
    updated_bulbs = [b for b in current_bulbs if b["ip"] != payload.ip]
    
    save_bulbs(updated_bulbs)
    
    # Fetch status of new bulb list
    tasks = [
        fetch_light_state(b["ip"], b["name"])
        for b in updated_bulbs
    ]
    updated_lights = await asyncio.gather(*tasks)
    
    return {
        "status": "success",
        "lights": list(updated_lights)
    }

@app.post("/api/lights/rename")
async def rename_light(payload: BulbRename):
    current_bulbs = load_bulbs()
    found = False
    for b in current_bulbs:
        if b["ip"] == payload.ip:
            b["name"] = payload.name.strip()
            found = True
            break
            
    if not found:
        raise HTTPException(status_code=404, detail="Bulb not found")
        
    save_bulbs(current_bulbs)
    
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

@app.post("/api/lights/{ip}/control")
async def control_light(ip: str, control: BulbControl):
    bulbs = load_bulbs()
    target_bulb = None
    for b in bulbs:
        if b["ip"] == ip:
            target_bulb = b
            break
            
    if not target_bulb:
        raise HTTPException(status_code=404, detail="Bulb not found in configuration")
        
    success = await send_control_to_bulb(ip, control)
    if not success:
        raise HTTPException(status_code=502, detail="Failed to communicate with the light")
        
    # Get updated state
    updated_state = await fetch_light_state(ip, target_bulb["name"])
    return {
        "status": "success",
        "light": updated_state
    }

@app.post("/api/lights/group/control")
async def control_group(control: BulbControl):
    bulbs = load_bulbs()
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

# Mount static files at root
app.mount("/", StaticFiles(directory="app/static", html=True), name="static")
