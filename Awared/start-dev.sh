#!/bin/bash

# Start all three in parallel
npx concurrently \
  --names "OLLAMA,SERVER,EXPO" \
  --prefix-colors "blue,green,yellow" \
  "ollama serve" \
  "npx tsx server/index.ts" \
  "npx expo start"
