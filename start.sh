#!/bin/bash

echo ""
echo "  ========================================"
echo "       ZecruAI - Starting up..."
echo "  ========================================"
echo ""

cd "$(dirname "$0")"

# Check if node is installed
if ! command -v node &> /dev/null; then
    echo "  [ERROR] Node.js is not installed."
    echo "  Download it from: https://nodejs.org"
    echo ""
    exit 1
fi

# Check if dependencies are installed
if [ ! -d "node_modules" ]; then
    echo "  Installing dependencies (first time only)..."
    echo ""
    npm install
    echo ""
fi

echo "  Starting ZecruAI..."
echo ""
echo "  Once ready, open: http://localhost:3000"
echo "  Keep this terminal open while using ZecruAI."
echo ""
echo "  ========================================"
echo ""

# Open browser after a short delay (background)
(sleep 4 && open http://localhost:3000 2>/dev/null || xdg-open http://localhost:3000 2>/dev/null) &

# Run the custom server
npx ts-node server.ts
