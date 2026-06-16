#!/bin/bash
# ====================================================================
# Monitor ms-openwpp — Health check
# Execução: a cada 1 hora via cron
# Notificação: via Evolution API (grupo Server_notification)
# ====================================================================
set -euo pipefail

WORK_DIR="/var/www/ms-openwpp"
LOG_DIR="$WORK_DIR/monitor/logs"
mkdir -p "$LOG_DIR"
LOG_FILE="$LOG_DIR/health_$(date +%Y%m%d).log"

# Evolution API para notificações
EVO_API_URL="http://localhost:5030"
EVO_INSTANCE="MS_Morato"
EVO_TOKEN="F49763A794EB-4ACE-8523-EA1B7FD29216"
NOTIFICATION_GROUP="120363409484120144@g.us"
NOTIFICATION_FALLBACK="5513988506358@s.whatsapp.net"

log() { echo "[$(date '+%Y-%m-%d %H:%M:%S')] [$1] $2" | tee -a "$LOG_FILE"; }
log_info() { log "INFO" "$1"; }
log_warn() { log "WARN" "$1"; }
log_error() { log "ERRO" "$1"; }

send_notification() {
    local message="$1"
    local target="$NOTIFICATION_GROUP"
    local target_name="grupo Server_notification"
    local json_payload
    json_payload=$(python3 -c "import json,sys; print(json.dumps({'number': sys.argv[1], 'text': sys.argv[2]}))" "$target" "$message")

    for attempt in 1 2; do
        response=$(curl -s --max-time 15 -X POST "$EVO_API_URL/message/sendText/$EVO_INSTANCE" \
            -H "Content-Type: application/json" \
            -H "apikey: $EVO_TOKEN" \
            -d "$json_payload")
        if echo "$response" | grep -q '"status":"PENDING"'; then
            log_info "Notificação enviada para $target_name"
            return 0
        fi
        if [ $attempt -eq 1 ]; then
            log_warn "Falha no grupo, tentando fallback..."
            target="$NOTIFICATION_FALLBACK"
            target_name="número pessoal"
            json_payload=$(python3 -c "import json,sys; print(json.dumps({'number': sys.argv[1], 'text': sys.argv[2]}))" "$target" "$message")
        fi
    done
    log_error "FALHA CRÍTICA: não foi possível enviar notificação"
    return 1
}

alerts=""

# 1. API health
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 http://localhost:3000/ 2>/dev/null || echo "000")
if [ "$HTTP_CODE" = "200" ]; then
    log_info "✅ HTTP respondendo (200)"
else
    log_error "❌ HTTP não respondeu (código: $HTTP_CODE)"
    alerts="${alerts}🔴 ms-openwpp HTTP não responde (código: $HTTP_CODE)\n"
fi

# 2. WhatsApp status via /api/debug
DEBUG=$(curl -s --max-time 10 http://localhost:3000/api/debug 2>/dev/null || echo "{}")
WA_STATUS=$(echo "$DEBUG" | python3 -c "import json,sys; d=json.load(sys.stdin); print(d.get('status','unknown'))" 2>/dev/null || echo "unknown")
if [ "$WA_STATUS" = "Conectado" ]; then
    log_info "✅ WhatsApp: Conectado"
else
    log_warn "⚠️ WhatsApp: $WA_STATUS"
    alerts="${alerts}⚠️ WhatsApp desconectado (status: $WA_STATUS)\n"
fi

# 3. Chrome memory
CHROME_PID=$(pgrep -f "chrome.*wwebjs" | head -1 || echo "")
if [ -n "$CHROME_PID" ]; then
    CHROME_MEM=$(ps -o rss= -p "$CHROME_PID" 2>/dev/null | awk '{printf "%.0f", $1/1024}' || echo "0")
    log_info "✅ Chrome: ${CHROME_MEM}MB (PID $CHROME_PID)"
    if [ "$CHROME_MEM" -gt 4096 ]; then
        log_warn "⚠️ Chrome com memória alta: ${CHROME_MEM}MB (>4GB)"
        alerts="${alerts}⚠️ Chrome com ${CHROME_MEM}MB de RAM (>4GB)\n"
    fi
else
    log_warn "⚠️ Chrome não encontrado"
    alerts="${alerts}⚠️ Chrome (Puppeteer) não está rodando\n"
fi

# 4. Disco
disk=$(df / | awk 'NR==2 {print $5}' | sed 's/%//')
if [ "$disk" -gt 85 ]; then
    log_warn "⚠️ Disco em $disk%"
    alerts="${alerts}⚠️ Disco: $disk% usado\n"
else
    log_info "✅ Disco: $disk% usado"
fi

# Notificar se algo errado
if [ -n "$alerts" ]; then
    msg="📡 Health Check — $(date '+%d/%m/%Y %H:%M')\n${alerts}Ação necessária."
    send_notification "$msg"
fi
exit 0