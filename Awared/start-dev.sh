#!/bin/bash

# Detect current local IP (works on macOS and Linux)
if [[ "$OSTYPE" == "darwin"* ]]; then
  LOCAL_IP=$(ipconfig getifaddr en0 || ipconfig getifaddr en1)
else
  LOCAL_IP=$(hostname -I | awk '{print $1}')
fi

if [ -z "$LOCAL_IP" ]; then
  echo "could not detect local ip"
  exit 1
fi

echo "detected ip: $LOCAL_IP"

# Write it into .env (updates the line in place, or appends if missing)
if grep -q "EXPO_PUBLIC_API_URL" .env 2>/dev/null; then
  sed -i.bak "s|EXPO_PUBLIC_API_URL=.*|EXPO_PUBLIC_API_URL=http://$LOCAL_IP:3000|" .env
else
  echo "EXPO_PUBLIC_API_URL=http://$LOCAL_IP:3000" >> .env
fi

echo "Updated .env → EXPO_PUBLIC_API_URL=http://$LOCAL_IP:3000"

# Start all three in parallel, each with a label
npx concurrently \
  --names "OLLAMA,SERVER,EXPO" \
  --prefix-colors "blue,green,yellow" \
  "ollama serve" \
  "npx tsx server/index.ts" \
  "npx expo start"
