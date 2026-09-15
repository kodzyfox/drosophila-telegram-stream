"""
Drosophila Visual & Dopaminergic Virality Analysis Engine.
Simulates compound eye ommatidia processing, contrast/edge detection,
and mushroom body PAM dopaminergic cluster firing rates (Hz).
"""

import math
import random
from io import BytesIO
from PIL import Image, ImageStat, ImageFilter


def analyze_image_for_fly_brain(image_bytes: bytes) -> dict:
    """
    Analyzes an image using Drosophila neurobiology principles:
    - Compound eye photoreceptor activation (R1-R6, R7/R8)
    - Lamina L1-L3 edge contrast detection
    - Mushroom body PAM dopaminergic reward projection (Hz)
    - Fly Virality Score (0-100%) and emoji reaction
    """
    try:
        img = Image.open(BytesIO(image_bytes)).convert("RGB")
    except Exception as e:
        return _fallback_metrics(f"Error parsing image: {e}")

    width, height = img.size
    
    # 1. Downsample to Drosophila ommatidia resolution (~80x80 compound eye grid)
    ommatidia_res = (75, 75)
    fly_view = img.resize(ommatidia_res, Image.Resampling.BILINEAR)
    
    # 2. Photoreceptor channel split (R, G, B channels as proxy for Rh1, Rh6, etc.)
    stat = ImageStat.Stat(fly_view)
    mean_r, mean_g, mean_b = stat.mean[:3]
    std_r, std_g, std_b = stat.stddev[:3]
    
    # 3. Luminance and Global Contrast (L1/L2 lamina cell activation)
    gray_view = fly_view.convert("L")
    gray_stat = ImageStat.Stat(gray_view)
    avg_luminance = gray_stat.mean[0]  # 0 to 255
    contrast_std = gray_stat.stddev[0]  # higher std = higher contrast
    contrast_norm = min(1.0, contrast_std / 75.0)  # normalized 0-1
    
    # 4. Edge density & High Spatial Frequency (L3 and T4/T5 motion/edge detectors)
    edges = gray_view.filter(ImageFilter.FIND_EDGES)
    edge_stat = ImageStat.Stat(edges)
    edge_density = min(1.0, edge_stat.mean[0] / 30.0)
    
    # 5. Color Saturation / Saliency (sugar/fruit/pheromone cues in Drosophila)
    hsv_view = fly_view.convert("HSV")
    h, s, v = hsv_view.split()
    sat_stat = ImageStat.Stat(s)
    avg_saturation = sat_stat.mean[0] / 255.0  # normalized 0-1
    
    # 6. Warmth Index (Drosophila attraction to red/orange/yellow vs avoidance of extreme UV/cold blue)
    warmth = max(0.0, min(1.0, (mean_r * 1.2 + mean_g * 0.8 - mean_b) / 255.0))
    
    # 7. Fly Virality Score Calculation (0 to 100)
    # Balanced weighting of contrast, color richness, edge detail, and warmth
    raw_score = (
        contrast_norm * 32.0 +
        avg_saturation * 28.0 +
        edge_density * 25.0 +
        warmth * 15.0
    )
    
    # Ensure reasonable bounds
    virality_score = round(max(15.0, min(99.4, raw_score + random.uniform(-2.0, 2.0))), 1)
    
    # 8. Dopamine Activity in Hz (PAM cluster firing rate, 15 PAM11 neurons as in the video)
    # Resting rate: ~72-78 Hz. Peak rate on superstimulus: ~110-125 Hz.
    dopamine_hz = round(68.0 + (virality_score / 100.0) * 48.0 + random.uniform(-1.2, 1.2), 1)
    
    # 9. Fly Spikes in 50ms of neural time (matching the video's counter around ~60k-70k spikes)
    fly_spikes = int(52000 + (virality_score / 100.0) * 16000 + random.randint(-400, 500))
    
    # 10. Verdict & Telegram Reaction
    if virality_score >= 85:
        reaction = "🔥"
        verdict = "ВИРУСНЫЙ ХИТ! Экстремальный всплеск дофамина у дрозофилы"
        reasoning = f"Очень высокий контраст ({int(contrast_norm*100)}%) и насыщенная палитра вызвали мощный разряд дофаминовых нейронов PAM11 ({dopamine_hz} Hz). Муха в восторге!"
    elif virality_score >= 72:
        reaction = "❤️"
        verdict = "ВЫСОКАЯ ВИРАЛЬНОСТЬ! Муха ставит лайк"
        reasoning = f"Отличный зрительный отклик ({int(edge_density*100)}% деталей). Частота разряда PAM подскочила до {dopamine_hz} Hz. Пост привлекает внимание!"
    elif virality_score >= 58:
        reaction = "🤩"
        verdict = "ХОРОШИЙ КОНТЕНТ! Заметный интерес"
        reasoning = f"Умеренно-высокая активность сетчатки. Частота {dopamine_hz} Hz выше базовой, аудитория задержит взгляд."
    elif virality_score >= 42:
        reaction = "👍"
        verdict = "СРЕДНИЙ ОТКЛИК: Нормальный пост"
        reasoning = f"Стандартный фоновый уровень дофамина ({dopamine_hz} Hz). Картинка спокойная, без резких визуальных триггеров."
    elif virality_score >= 28:
        reaction = "👀"
        verdict = "НИЗКИЙ ИНТЕРЕС: Мало триггеров"
        reasoning = f"Низкая контрастность ({int(contrast_norm*100)}%). Рецепторы R1-R6 среагировали слабо, дофамин всего {dopamine_hz} Hz."
    else:
        reaction = "💩"
        verdict = "СКУЧНО ДЛЯ МУХИ: Дофамин подавлен"
        reasoning = f"Недостаток контраста и насыщенности. Частота разряда упала до {dopamine_hz} Hz. Муха теряет внимание."

    return {
        "virality_score": virality_score,
        "dopamine_hz": dopamine_hz,
        "fly_spikes": fly_spikes,
        "reaction": reaction,
        "verdict": verdict,
        "reasoning": reasoning,
        "metrics": {
            "contrast": round(contrast_norm * 100, 1),
            "saturation": round(avg_saturation * 100, 1),
            "edge_density": round(edge_density * 100, 1),
            "warmth": round(warmth * 100, 1),
            "ommatidia_res": "75x75 facets"
        }
    }


def _fallback_metrics(reason: str = "Fallback") -> dict:
    hz = round(random.uniform(75.0, 85.0), 1)
    spikes = random.randint(61000, 64000)
    score = round(random.uniform(50.0, 70.0), 1)
    return {
        "virality_score": score,
        "dopamine_hz": hz,
        "fly_spikes": spikes,
        "reaction": "👍",
        "verdict": "Базовый зрительный отклик",
        "reasoning": f"Стандартная нейронная активность: {reason}",
        "metrics": {
            "contrast": 50.0,
            "saturation": 50.0,
            "edge_density": 50.0,
            "warmth": 50.0,
            "ommatidia_res": "75x75 facets"
        }
    }
