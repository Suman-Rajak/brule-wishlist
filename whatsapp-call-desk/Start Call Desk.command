#!/bin/bash
# Double-click to start Brulé Call Desk on a Mac.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo
  echo "  Node.js is not installed yet. Opening the download page…"
  echo "  Install the LTS version, then double-click this file again."
  open "https://nodejs.org/en/download"
  echo
  read -n 1 -s -r -p "  Press any key to close."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo
  echo "  First start: installing Call Desk. This downloads about 200 MB and happens only once."
  echo
  if ! npm install; then
    echo
    echo "  The install failed — see the messages above."
    read -n 1 -s -r -p "  Press any key to close."
    exit 1
  fi
fi

echo
echo "  Starting Call Desk. Your browser will open in a moment."
echo "  Keep this window open while you use it. Close it to stop Call Desk."
echo
npm start
