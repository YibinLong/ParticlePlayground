#!/bin/bash

# ParticlePlayground - Dev Server Script
# Starts a local development server with caching disabled

PORT=${1:-8080}
DIR="$(cd "$(dirname "$0")" && pwd)"

echo "Starting ParticlePlayground..."
echo "Server: http://localhost:$PORT"
echo "Press Ctrl+C to stop"
echo ""

cd "$DIR"

# Use custom no-cache server for development
if command -v python3 &> /dev/null; then
    python3 server.py $PORT
elif command -v python &> /dev/null; then
    python server.py $PORT
else
    echo "Error: Python not found."
    exit 1
fi
