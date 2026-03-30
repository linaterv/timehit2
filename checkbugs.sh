#!/bin/bash
# List and display open (unfixed) bug reports
DIR="$(dirname "$0")/bug-reports"
FILES=$(ls -t "$DIR" 2>/dev/null | grep -v '^fixed-')
if [ -z "$FILES" ]; then
  echo "No open bugs."
  exit 0
fi
echo "$FILES" | while read f; do
  echo "=== $f ==="
  cat "$DIR/$f"
  echo
done
