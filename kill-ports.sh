#!/bin/bash

# Kill processes running on specified ports
# Usage: ./kill-ports.sh [port1] [port2] ...
# Default: kills common dev ports (8080, 3000, 5000)

if [ $# -eq 0 ]; then
    PORTS=(8080 3000 5000)
else
    PORTS=("$@")
fi

echo "Killing processes on ports: ${PORTS[*]}"
echo ""

for PORT in "${PORTS[@]}"; do
    PID=$(lsof -ti :$PORT 2>/dev/null)
    if [ -n "$PID" ]; then
        echo "Port $PORT: Killing PID $PID"
        kill -9 $PID 2>/dev/null
        if [ $? -eq 0 ]; then
            echo "  -> Killed successfully"
        else
            echo "  -> Failed to kill (may need sudo)"
        fi
    else
        echo "Port $PORT: No process found"
    fi
done

echo ""
echo "Done!"
