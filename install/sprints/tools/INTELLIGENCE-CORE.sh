#!/bin/bash
# ==========================================
# RL.SYS - INTELLIGENCE CORE ENGINE
# ENGINE: GEMINI 1.5 FLASH (REST API)
# PHASE: INSTITUTIONAL_WARMUP_INTELLIGENCE
# ==========================================

# Configurações de Ambiente
ROOT_DIR="/data/data/com.termux/files/home/rlsys-terminal-main"
LOG_DIR="$ROOT_DIR/logs/intelligence"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")

mkdir -p "$LOG_DIR"

# Barreira de Segurança: Validação de Chave
if [ -z "$GEMINI_API_KEY" ]; then
    echo "[ERROR] Variável GEMINI_API_KEY ausente do ambiente."
    echo "[ERROR] Para operar sem custos infraestruturais, gere uma chave no Google AI Studio e execute: export GEMINI_API_KEY=\"sua_chave\""
    exit 1
fi

echo "[INTELLIGENCE-CORE] [$TIMESTAMP] Iniciando pipeline de analise flash..."

# Simulação da leitura do estado atual (Sprint 434)
RUNTIME_DATA='{"convergence": 76, "decisionScore": 70, "windowConfidence": 85, "regime": "CONFIRMED_OPENING", "decay": -8}'

# Correção Lógica: Escapando aspas duplas nativamente no Bash para preservar o Payload
ESCAPED_DATA="${RUNTIME_DATA//\"/\\\"}"

# Payload Enterprise: Uso estrito de JSON (application/json) para evitar quebra de parser
PAYLOAD=$(cat <<EOF
{
  "contents": [{
    "parts": [{
      "text": "Atue como o motor de regras corporativo do sistema RL.SYS. Avalie o estado atual das métricas: $ESCAPED_DATA. Retorne APENAS um objeto JSON com as chaves: 'action' (string, escolha entre: HOLD, ADVANCE, RETRACT), 'confidence' (integer, 0-100), e 'directive' (string, justificativa curta de no máximo 10 palavras). Nenhuma outra palavra deve ser gerada."
    }]
  }],
  "generationConfig": {
    "temperature": 0.0,
    "responseMimeType": "application/json"
  }
}
EOF
)

# Chamada REST direta, minimizando dependências externas
RESPONSE=$(curl -s -H 'Content-Type: application/json' \
     -d "$PAYLOAD" \
     -X POST "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$GEMINI_API_KEY")

# Filtragem e limpeza usando jq (Garante que apenas o bloco de texto saia)
CLEAN_OUTPUT=$(echo "$RESPONSE" | jq -r '.candidates[0].content.parts[0].text' 2>/dev/null)

if [ -z "$CLEAN_OUTPUT" ] || [ "$CLEAN_OUTPUT" == "null" ]; then
    echo "[ERROR] Falha na comunicação com o motor cognitivo."
    echo "$RESPONSE" > "$LOG_DIR/error_$TIMESTAMP.log"
    exit 1
fi

# Registro em log imutável
LOG_FILE="$LOG_DIR/decision_$TIMESTAMP.json"
echo "$CLEAN_OUTPUT" > "$LOG_FILE"

echo "[INTELLIGENCE-CORE] [SUCCESS] Resposta computada determinísticamente."
echo "[INTELLIGENCE-CORE] Artefato gerado em: $LOG_FILE"
echo "===================================="
cat "$LOG_FILE" | jq .
echo "===================================="
echo "[INTELLIGENCE-CORE] PIPELINE ENCERRADO"

