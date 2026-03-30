#!/bin/bash
cd "$(dirname "$0")"
lsof -ti :3002 | xargs kill -9 2>/dev/null
npx next build && npx next start --port 3002
