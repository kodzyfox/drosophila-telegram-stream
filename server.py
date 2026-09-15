"""
FastAPI Server for FlyBrain 3D Telegram Virality Explorer.
"""

import os
import json
import uuid
import uvicorn
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import JSONResponse, FileResponse
from fastapi.middleware.cors import CORSMiddleware

from engine.fly_vision import analyze_image_for_fly_brain
from engine.telegram_client import (
    get_config, save_config, check_bot_token, 
    fetch_channel_updates, send_telegram_reaction, FEED_CACHE_DIR
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PUBLIC_DIR = os.path.join(BASE_DIR, "public")
ASSETS_DIR = os.path.join(PUBLIC_DIR, "assets")

app = FastAPI(title="FlyBrain Telegram Virality Explorer")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# In-memory local posts store (seeded with demo posts)
LOCAL_POSTS = []
DEMO_PATH = os.path.join(ASSETS_DIR, "demo_posts.json")
if os.path.exists(DEMO_PATH):
    try:
        with open(DEMO_PATH, "r", encoding="utf-8") as f:
            LOCAL_POSTS = json.load(f)
    except Exception:
        pass


@app.get("/api/config")
def api_get_config():
    cfg = get_config()
    bot_info = None
    if cfg.get("bot_token"):
        bot_info = check_bot_token(cfg["bot_token"])
    return {
        "config": cfg,
        "bot_info": bot_info
    }


@app.post("/api/config")
def api_save_config(data: dict):
    bot_token = data.get("bot_token", "").strip()
    channel = data.get("channel", "@fluffy_tail_group").strip()
    auto_react = bool(data.get("auto_react", True))

    cfg = {
        "bot_token": bot_token,
        "channel": channel,
        "auto_react": auto_react
    }
    save_config(cfg)
    
    bot_info = check_bot_token(bot_token) if bot_token else None
    return {
        "ok": True,
        "config": cfg,
        "bot_info": bot_info
    }


@app.get("/api/posts")
def api_get_posts():
    cfg = get_config()
    token = cfg.get("bot_token")
    channel = cfg.get("channel", "@fluffy_tail_group")

    tg_posts = []
    if token:
        tg_posts = fetch_channel_updates(token, channel)

    # Combine Telegram posts (if any) with local/demo posts
    combined = list(tg_posts)
    # add local posts that aren't duplicates
    existing_ids = {p["id"] for p in combined}
    for lp in LOCAL_POSTS:
        if lp["id"] not in existing_ids:
            combined.append(lp)

    member_count = 6582
    if token:
        try:
            r = requests.get(f"https://api.telegram.org/bot{token}/getChatMemberCount?chat_id={channel}", timeout=5, verify=False).json()
            if r.get("ok"):
                member_count = r["result"]
        except Exception:
            pass

    avatar_path = "assets/channel_avatar.jpg" if os.path.exists(os.path.join(ASSETS_DIR, "channel_avatar.jpg")) else None

    return {
        "posts": combined,
        "source": "telegram" if tg_posts else "local_demo",
        "channel": channel,
        "member_count": member_count,
        "avatar": avatar_path
    }


@app.post("/api/upload")
async def api_upload_photo(file: UploadFile = File(...), title: str = Form("Uploaded Image")):
    content = await file.read()
    ext = os.path.splitext(file.filename)[1] or ".jpg"
    new_id = f"user_{uuid.uuid4().hex[:8]}"
    fname = f"{new_id}{ext}"
    dest = os.path.join(FEED_CACHE_DIR, fname)
    with open(dest, "wb") as f:
        f.write(content)

    new_post = {
        "id": new_id,
        "message_id": 9999,
        "photo": f"assets/feed_cache/{fname}",
        "text": title,
        "title": title,
        "channel": "@fluffy_tail_group (Local Drop)",
        "date": 0
    }
    LOCAL_POSTS.insert(0, new_post)
    return {"ok": True, "post": new_post}


@app.post("/api/analyze")
def api_analyze(data: dict):
    photo_rel_path = data.get("photo")
    if not photo_rel_path:
        raise HTTPException(status_code=400, detail="Missing photo path")

    # Clean path
    rel = photo_rel_path.lstrip("/")
    abs_path = os.path.join(PUBLIC_DIR, rel)
    if not os.path.exists(abs_path):
        raise HTTPException(status_code=404, detail="Photo file not found")

    with open(abs_path, "rb") as f:
        img_bytes = f.read()

    analysis = analyze_image_for_fly_brain(img_bytes)

    # If auto-react is enabled and we have a valid telegram token and post
    cfg = get_config()
    reaction_sent = None
    if cfg.get("auto_react") and cfg.get("bot_token") and data.get("message_id"):
        try:
            reaction_sent = send_telegram_reaction(
                cfg["bot_token"],
                cfg.get("channel", "@fluffy_tail_group"),
                int(data["message_id"]),
                analysis["reaction"]
            )
        except Exception as e:
            reaction_sent = {"error": str(e)}

    return {
        "analysis": analysis,
        "reaction_sent": reaction_sent
    }


@app.post("/api/react")
def api_send_manual_reaction(data: dict):
    cfg = get_config()
    token = cfg.get("bot_token")
    channel = cfg.get("channel", "@fluffy_tail_group")
    message_id = data.get("message_id")
    emoji = data.get("emoji", "🔥")

    if not token or not message_id:
        return {"ok": False, "error": "Bot token or message_id missing"}

    res = send_telegram_reaction(token, channel, int(message_id), emoji)
    return res


@app.get("/api/brain/info")
def api_brain_info():
    neuropils_path = os.path.join(ASSETS_DIR, "neuropils.json")
    neurons_path = os.path.join(ASSETS_DIR, "neurons.json")
    
    neuropils = []
    neurons = []
    if os.path.exists(neuropils_path):
        with open(neuropils_path, "r") as f:
            neuropils = json.load(f)
    if os.path.exists(neurons_path):
        with open(neurons_path, "r") as f:
            neurons = json.load(f)

    return {
        "brain_model": "assets/fly_brain.glb",
        "neuropils": neuropils,
        "neurons": neurons,
        "total_fly_neurons": 139255,
        "total_fly_synapses": 54500000,
        "reference": "FlyWire Consortium / Nature 2024"
    }


# Mount public directory
app.mount("/", StaticFiles(directory=PUBLIC_DIR, html=True), name="public")

if __name__ == "__main__":
    uvicorn.run("server:app", host="0.0.0.0", port=8080, reload=True)
