#!/bin/bash
# ====================================================================
# Cleanup .media-cache/ — remove arquivos não acessados há 7 dias
# Execução: 1x por semana (domingo 05:00 via cron)
# ====================================================================
set -euo pipefail

MEDIA_DIR="/var/www/ms-openwpp/.media-cache"
LOG_DIR="/var/www/ms-openwpp/monitor/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/cleanup_media_$(date +%Y%m%d).log"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" >> "$LOG_FILE"; }

if [ ! -d "$MEDIA_DIR" ]; then
    log "Diretório $MEDIA_DIR não existe. Saindo."
    exit 0
fi

BEFORE=$(find "$MEDIA_DIR" -type f | wc -l)
BEFORE_SIZE=$(du -sh "$MEDIA_DIR" | awk '{print $1}')

# Remove arquivos não acessados há mais de 7 dias
find "$MEDIA_DIR" -type f -atime +7 -delete 2>/dev/null

AFTER=$(find "$MEDIA_DIR" -type f | wc -l)
AFTER_SIZE=$(du -sh "$MEDIA_DIR" | awk '{print $1}')
REMOVED=$((BEFORE - AFTER))

log "Antes: ${BEFORE} arquivos (${BEFORE_SIZE}) | Depois: ${AFTER} arquivos (${AFTER_SIZE}) | Removidos: ${REMOVED}"
echo "[$(date '+%Y-%m-%d %H:%M:%S')] Media cache: ${REMOVED} arquivos removidos (${BEFORE_SIZE} → ${AFTER_SIZE})"
