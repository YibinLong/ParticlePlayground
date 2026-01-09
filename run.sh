#!/bin/bash

# ParticlePlayground - Dev Server Script
# Starts a local development server

PORT=${1:-8080}
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting ParticlePlayground..."
echo "Server: http://localhost:$PORT"
echo "Press Ctrl+C to stop"
echo ""

cd "$DIR"

# Try npx serve first (better), fallback to Python
if command -v npx &> /dev/null; then
    npx serve -l $PORT
elif command -v python3 &> /dev/null; then
    python3 -m http.server $PORT
elif command -v python &> /dev/null; then
    python -m http.server $PORT
else
    echo "Error: No suitable server found. Install Node.js or Python."
    exit 1
fi
