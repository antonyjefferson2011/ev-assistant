
import ctypes
import json
import os
import time
from datetime import datetime
from pathlib import Path

import psutil
import pystray
import win32gui
import win32process
from PIL import Image, ImageDraw

BASE = Path(os.environ["LOCALAPPDATA"]) / "JarvisAgent"
LOG_FILE = BASE / "activity.jsonl"
BASE.mkdir(parents=True, exist_ok=True)

paused = False
running = True


def active_app():
    try:
        hwnd = win32gui.GetForegroundWindow()
        if not hwnd:
            return "unknown"

        _, pid = win32process.GetWindowThreadProcessId(hwnd)
        return psutil.Process(pid).name()[:120]
    except (psutil.Error, OSError):
        return "unknown"


def record(app, seconds):
    item = {
        "time": datetime.now().isoformat(timespec="seconds"),
        "app": app,
        "duration_seconds": seconds,
    }

    with LOG_FILE.open("a", encoding="utf-8") as file:
        file.write(json.dumps(item, ensure_ascii=False) + "\n")


def make_icon():
    image = Image.new("RGB", (64, 64), "#101827")
    draw = ImageDraw.Draw(image)
    draw.ellipse((10, 10, 54, 54), fill="#36cfc9")
    draw.text((24, 21), "J", fill="#101827")
    return image


def toggle_pause(icon, item):
    global paused
    paused = not paused
    icon.title = "JARVIS — " + ("Pausado" if paused else "Monitoramento ativo")


def quit_agent(icon, item):
    global running
    running = False
    icon.stop()


def monitor():
    last_app = None
    last_time = time.monotonic()

    while running:
        time.sleep(2)
        now = time.monotonic()

        if paused:
            last_app = None
            last_time = now
            continue

        app = active_app()

        if app != last_app:
            if last_app is not None:
                record(last_app, max(0, round(now - last_time)))

            last_app = app
            last_time = now


def main():
    import threading

    menu = pystray.Menu(
        pystray.MenuItem("Pausar / retomar", toggle_pause),
        pystray.MenuItem("Encerrar JARVIS", quit_agent),
    )

    icon = pystray.Icon(
        "JarvisAgent",
        make_icon(),
        "JARVIS — Monitoramento ativo",
        menu,
    )

    threading.Thread(target=monitor, daemon=True).start()
    icon.run()


if __name__ == "__main__":
    main()
