#!/usr/bin/env bash
set -euo pipefail

echo "======================================"
echo " RL.SYS CORE - SPRINT 458-D"
echo " JSON MASTER PARSER (HOTFIX)"
echo "======================================"

ROOT_DIR=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
cd "$ROOT_DIR"

FILE="src/presentation/cli/LivePaperOrchestrator.ts"

# Atualiza a Regex para ler o formato exato da sua API ("number": 23)
sed -i '/if (cmd.startsWith('\''clean '\'')) {/,/return;/c\
            if (cmd.startsWith('\''clean '\'')) {\
                const targetFile = line.replace(/clean\\s+/i, '\'''\'').trim();\
                console.clear();\
                console.log('\''======================================================'\'');\
                console.log('\'' 🧹 MOTOR DE EXTRAÇÃO JSON MASTER'\'');\
                console.log('\''======================================================'\'');\
                try {\
                    const rawContent = fs.readFileSync(path.resolve(process.cwd(), targetFile), '\''utf8'\'');\
                    let validSpins: number[] = [];\
                    // Nova Regex Mestra: Captura "result", "number" ou "value"\
                    const jsonRegex = /"(?:result|number|value|spin)"\\s*:\\s*(\\d+)/gi;\
                    let match;\
                    let foundJson = false;\
                    while ((match = jsonRegex.exec(rawContent)) !== null) {\
                        foundJson = true;\
                        const num = parseInt(match[1], 10);\
                        if (num >= 0 && num <= 36) validSpins.push(num);\
                    }\
                    if (!foundJson) {\
                        const lines = rawContent.split(/\\r?\\n/);\
                        lines.forEach(line => {\
                            const cleanLine = line.trim();\
                            if (/^\\d{1,2}$/.test(cleanLine)) {\
                                const num = parseInt(cleanLine, 10);\
                                if (num >= 0 && num <= 36) validSpins.push(num);\
                            }\
                        });\
                        validSpins.reverse();\
                    } else {\
                        validSpins.reverse();\
                    }\
                    if (validSpins.length > 0) {\
                        const cleanSequence = validSpins.join('\'','\'');\
                        const outPath = path.join(process.cwd(), '\''data'\'', '\''fita_limpa.txt'\'');\
                        fs.writeFileSync(outPath, cleanSequence);\
                        console.log(`\\x1b[32m[SUCESSO] ${validSpins.length} giros purificados extraídos da API!\\x1b[0m`);\
                        console.log(`\\x1b[33m[CRONOLOGIA] Ordem invertida para simulação (Passado -> Presente).\\x1b[0m`);\
                        console.log(` Salvo em: \\x1b[36m${outPath}\\x1b[0m`);\
                    } else {\
                        console.log('\''\\x1b[31m[ERRO] Nenhum giro válido em JSON encontrado.\\x1b[0m'\'');\
                    }\
                } catch (e) {\
                    console.log(`\\x1b[31m[ERRO] Falha ao ler o arquivo: ${targetFile}\\x1b[0m`);\
                }\
                console.log('\''======================================================'\'');\
                console.log('\''Pressione ENTER para retornar...'\'');\
                this.inputMode = '\''VIEW_ONLY'\'';\
                return;\
            }' $FILE

echo "[+] Recompilando..."
npx tsc

echo -e "\033[1;32m SPRINT 458-D INSTALADA COM SUCESSO \033[0m"
