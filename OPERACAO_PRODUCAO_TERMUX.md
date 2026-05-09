# Operação em Termux/ArchLinux — RL.SYS Core v1.0.0

## Instalação
```bash
npm install
npm run build
```

## Validação padrão
```bash
npm run check
```

## Validação de release
```bash
npm run release:check
```

## Inicialização
```bash
npm start
```

## Endpoints úteis
```bash
curl http://127.0.0.1:3000/health
curl http://127.0.0.1:3000/api/strategy/readiness
curl http://127.0.0.1:3000/api/strategy/metrics
curl http://127.0.0.1:3000/api/system/config
curl http://127.0.0.1:3000/api/system/release-readiness
```

## Variáveis principais
```bash
PORT=3000
HOST=0.0.0.0
LOG_LEVEL=info
DATA_PATH=./data
SIGNAL_LOG_PATH=./data/signals.jsonl
AUDIT_LOG_PATH=./data/decision-audit.jsonl
GEMINI_API_KEY=
```

## Segurança
Nunca versionar `.env`, logs JSONL reais, tokens ou dados pessoais. O endpoint `/api/system/config` é sanitizado e não expõe a chave Gemini.
