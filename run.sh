#!/bin/bash
# One-click launcher for FlyBrain Telegram Virality Explorer

cd "$(dirname "$0")"

echo "=========================================================="
echo "   🧠 FLYBRAIN: TELEGRAM VIRALITY EXPLORER & 3D FLY      "
echo "   Based on FlyWire Whole-Brain Connectome (Nature 2024) "
echo "=========================================================="

if [ ! -d "venv" ]; then
    echo "Virtual environment not found. Please run setup first."
    exit 1
fi

echo "Starting FlyBrain server on http://localhost:8080 ..."
./venv/bin/python3 server.py
