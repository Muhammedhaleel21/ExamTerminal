#!/usr/bin/env bash
# ExamTerminal - One-line file downloader for Linux & macOS
# Usage: curl -fsSL https://YOURDOMAIN.com/get | bash

set -e

DEFAULT_BASE_URL="https://YOURDOMAIN.com"
BASE_URL="${BASE_URL:-$DEFAULT_BASE_URL}"

# If an argument is provided (e.g. curl ... | bash -s https://domain.com)
if [ -n "$1" ]; then
  BASE_URL="$1"
fi

# If BASE_URL is still placeholder, prompt the user if interactive or show error
if [ "$BASE_URL" = "__BASE_URL__" ] || [ "$BASE_URL" = "https://YOURDOMAIN.com" ]; then
  if [ -c /dev/tty ]; then
    printf "Enter repository URL (e.g. https://yourdomain.com): " >/dev/tty
    read -r BASE_URL </dev/tty
  else
    printf "Error: BASE_URL is not configured. Please pass BASE_URL=https://... or specify repository.\n" >&2
    exit 1
  fi
fi

# Strip trailing slash
BASE_URL="${BASE_URL%/}"

echo "==========================================="
echo "  ExamTerminal File Downloader             "
echo "==========================================="
echo "Repository : $BASE_URL"
echo "Destination: ./MyFiles"
echo ""

TARGET_DIR="${PWD}/MyFiles"
mkdir -p "$TARGET_DIR"

# Pre-compiled file list (urlPath|relativePath)
FILES=(
  "Data%20Mining/Module%201.txt|Data Mining/Module 1.txt"
  "Data%20Mining/Questions.txt|Data Mining/Questions.txt"
  "Machine%20learning/Module%201.txt|Machine learning/Module 1.txt"
  "Machine%20learning/Module%202.txt|Machine learning/Module 2.txt"
  "Machine%20learning/Module%203.txt|Machine learning/Module 3.txt"
  "Python/Advanced.txt|Python/Advanced.txt"
  "Python/Basics.txt|Python/Basics.txt"
)

TOTAL=${#FILES[@]}
DOWNLOADED=0
SKIPPED=0
FAILED=0
INDEX=0

for item in "${FILES[@]}"; do
  INDEX=$((INDEX + 1))
  URL_PATH="${item%%|*}"
  REL_PATH="${item##*|}"
  PCT=$((INDEX * 100 / TOTAL))

  DEST_PATH="${TARGET_DIR}/${REL_PATH}"
  DEST_DIR="$(dirname "$DEST_PATH")"
  mkdir -p "$DEST_DIR"

  printf "[%d/%d] (%d%%) %s" "$INDEX" "$TOTAL" "$PCT" "$REL_PATH"

  # Avoid overwriting existing files without warning
  if [ -f "$DEST_PATH" ]; then
    SHOULD_OVERWRITE=false
    if [ "${FORCE:-0}" = "1" ] || [ "${OVERWRITE:-0}" = "1" ]; then
      SHOULD_OVERWRITE=true
    elif [ -c /dev/tty ] && [ -t 1 ]; then
      printf "\n"
      printf "  File '%s' already exists. Overwrite? [y/N]: " "$REL_PATH" >/dev/tty
      read -r ANS </dev/tty
      if [ "$ANS" = "y" ] || [ "$ANS" = "Y" ]; then
        SHOULD_OVERWRITE=true
      fi
    fi

    if [ "$SHOULD_OVERWRITE" = false ]; then
      printf " -> [SKIPPED: File exists]\n"
      SKIPPED=$((SKIPPED + 1))
      continue
    fi
  fi

  FILE_URL="${BASE_URL}/downloads/${URL_PATH}"
  if curl -fsSL "$FILE_URL" -o "$DEST_PATH"; then
    printf " -> [OK]\n"
    DOWNLOADED=$((DOWNLOADED + 1))
  else
    printf " -> [FAILED]\n"
    FAILED=$((FAILED + 1))
  fi
done

echo ""
echo "==========================================="
echo "Download Complete!"
echo "  Downloaded: $DOWNLOADED"
echo "  Skipped:    $SKIPPED"
echo "  Failed:     $FAILED"
echo "  Total:      $TOTAL"
echo "Files saved in: $TARGET_DIR"
echo "==========================================="

if [ "$FAILED" -gt 0 ]; then
  exit 1
fi

