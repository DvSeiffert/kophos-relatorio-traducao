#!/usr/bin/env bash
# Baixa a planilha do Google Sheets (CSV) para data/planilha.csv
# e registra a data da última sincronização em data/meta.json.
set -euo pipefail

SHEET_ID="${SHEET_ID:-1_5r5Iv9iSHfSa_QAIrfOwk5I9neJB-CSFZ3NwRKpN4U}"
SHEET_GID="${SHEET_GID:-0}"
URL="https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${SHEET_GID}"

cd "$(dirname "$0")/.."
tmp="$(mktemp)"
curl -fsSL "$URL" -o "$tmp"

# Proteção: só aceita se parecer a planilha certa (cabeçalho com "Livro")
if ! head -n1 "$tmp" | grep -q "^Livro"; then
  echo "Download não parece a planilha esperada; abortando." >&2
  head -c 500 "$tmp" >&2
  exit 1
fi

if cmp -s "$tmp" data/planilha.csv; then
  echo "Planilha sem alterações."
  echo "changed=false" >> "${GITHUB_OUTPUT:-/dev/null}"
else
  mv "$tmp" data/planilha.csv
  printf '{ "sincronizadoEm": "%s" }\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > data/meta.json
  echo "Planilha atualizada."
  echo "changed=true" >> "${GITHUB_OUTPUT:-/dev/null}"
fi
