"""
Telegram Bot API integration for channel post retrieval and reaction posting.
Supports fetching real channel history and live updates.
"""

import os
import json
import requests
import urllib3

urllib3.disable_warnings()

CONFIG_PATH = "/Users/kodzy/Desktop/fly/data/config.json"
CHANNEL_CACHE_PATH = "/Users/kodzy/Desktop/fly/data/channel_posts.json"
FEED_CACHE_DIR = "/Users/kodzy/Desktop/fly/public/assets/feed_cache"
os.makedirs(FEED_CACHE_DIR, exist_ok=True)
os.makedirs("/Users/kodzy/Desktop/fly/data", exist_ok=True)


def get_config() -> dict:
    if os.path.exists(CONFIG_PATH):
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                return json.load(f)
        except Exception:
            pass
    return {
        "bot_token": "",
        "channel": "@fluffy_tail_group",
        "auto_react": True
    }


def save_config(cfg: dict):
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(cfg, f, indent=2, ensure_ascii=False)


def check_bot_token(token: str) -> dict:
    if not token:
        return {"ok": False, "error": "Токен не указан"}
    try:
        url = f"https://api.telegram.org/bot{token}/getMe"
        res = requests.get(url, timeout=10, verify=False)
        data = res.json()
        if data.get("ok"):
            return {
                "ok": True,
                "bot_username": data["result"]["username"],
                "bot_name": data["result"].get("first_name", "Bot"),
                "bot_id": data["result"]["id"]
            }
        return {"ok": False, "error": data.get("description", "Неверный токен")}
    except Exception as e:
        return {"ok": False, "error": str(e)}


def fetch_channel_updates(token: str, channel: str) -> list:
    """
    Fetches real channel photos by scanning latest posts and recent updates.
    """
    if not token:
        return []

    # 1. Load cached channel posts if available
    cached_posts = []
    if os.path.exists(CHANNEL_CACHE_PATH):
        try:
            with open(CHANNEL_CACHE_PATH, "r", encoding="utf-8") as f:
                cached_posts = json.load(f)
        except Exception:
            pass

    # If we already have 5+ cached posts, return them first
    # and perform a fast scan for newest posts
    posts_by_id = {str(p["id"]): p for p in cached_posts}

    try:
        # Check channel info to get numeric chat_id
        chat_url = f"https://api.telegram.org/bot{token}/getChat?chat_id={channel}"
        chat_res = requests.get(chat_url, timeout=10, verify=False).json()
        if not chat_res.get("ok"):
            return list(posts_by_id.values())

        channel_id = chat_res["result"]["id"]

        # Get latest message ID from getUpdates to know where the channel is,
        # or from chat's pinned message
        pinned_mid = chat_res["result"].get("pinned_message", {}).get("message_id", 43369)
        top_mid = max(pinned_mid, 58086)

        # Check updates first
        upd_url = f"https://api.telegram.org/bot{token}/getUpdates?allowed_updates=[\"channel_post\",\"message\"]"
        upd_res = requests.get(upd_url, timeout=10, verify=False).json()
        
        user_chat_id = None
        if upd_res.get("ok"):
            for upd in upd_res.get("result", []):
                msg = upd.get("channel_post") or upd.get("message")
                if not msg:
                    continue
                if msg.get("from", {}).get("id"):
                    user_chat_id = msg["from"]["id"]
                mid = msg.get("message_id")
                if mid and mid > top_mid:
                    top_mid = mid

                # If message has direct photo
                photos = msg.get("photo")
                if photos:
                    p = _download_tg_photo(token, photos[-1]["file_id"], mid, msg.get("caption", ""), channel)
                    if p:
                        posts_by_id[str(p["id"])] = p

        # If user_chat_id is known, we can inspect latest channel posts
        if user_chat_id:
            # Scan top 15 messages downward to find photos
            for test_mid in range(top_mid, max(top_mid - 20, 1), -1):
                mid_str = str(test_mid)
                if mid_str in posts_by_id:
                    continue
                fwd_url = f"https://api.telegram.org/bot{token}/forwardMessage"
                fwd_res = requests.post(fwd_url, json={
                    "chat_id": user_chat_id,
                    "from_chat_id": channel_id,
                    "message_id": test_mid
                }, timeout=5, verify=False).json()

                if fwd_res.get("ok"):
                    fmsg = fwd_res["result"]
                    # Delete the forwarded message from user chat immediately
                    requests.post(f"https://api.telegram.org/bot{token}/deleteMessage", json={
                        "chat_id": user_chat_id,
                        "message_id": fmsg["message_id"]
                    }, timeout=5, verify=False)

                    photos = fmsg.get("photo")
                    if photos:
                        p = _download_tg_photo(token, photos[-1]["file_id"], test_mid, fmsg.get("caption", ""), channel)
                        if p:
                            posts_by_id[str(p["id"])] = p
                            if len(posts_by_id) >= 10:
                                break

        # Save to cache
        sorted_posts = sorted(posts_by_id.values(), key=lambda x: int(x.get("message_id", 0)), reverse=True)
        with open(CHANNEL_CACHE_PATH, "w", encoding="utf-8") as f:
            json.dump(sorted_posts, f, indent=2, ensure_ascii=False)

        return sorted_posts
    except Exception as e:
        print("Error fetching channel updates:", e)
        return list(posts_by_id.values())


def _download_tg_photo(token: str, file_id: str, message_id: int, caption: str, channel: str):
    try:
        f_info = requests.get(f"https://api.telegram.org/bot{token}/getFile?file_id={file_id}", timeout=10, verify=False).json()
        if f_info.get("ok"):
            file_path = f_info["result"]["file_path"]
            dl_url = f"https://api.telegram.org/file/bot{token}/{file_path}"
            local_name = f"tg_{message_id}.jpg"
            dest = os.path.join(FEED_CACHE_DIR, local_name)
            if not os.path.exists(dest):
                img_data = requests.get(dl_url, timeout=15, verify=False).content
                with open(dest, "wb") as f:
                    f.write(img_data)
            return {
                "id": str(message_id),
                "message_id": message_id,
                "photo": f"assets/feed_cache/{local_name}",
                "text": caption or "Fluffy tail media post",
                "title": caption[:40] if caption else f"Post #{message_id}",
                "channel": channel
            }
    except Exception as e:
        print(f"Error downloading photo {file_id}:", e)
    return None


def send_telegram_reaction(token: str, channel: str, message_id: int, emoji: str) -> dict:
    if not token or not message_id:
        return {"ok": False, "error": "Missing token or message_id"}

    try:
        url = f"https://api.telegram.org/bot{token}/setMessageReaction"
        payload = {
            "chat_id": channel if str(channel).startswith("@") or str(channel).startswith("-") else f"@{channel}",
            "message_id": int(message_id),
            "reaction": [{"type": "emoji", "emoji": emoji}],
            "is_big": True
        }
        res = requests.post(url, json=payload, timeout=10, verify=False)
        return res.json()
    except Exception as e:
        return {"ok": False, "error": str(e)}
