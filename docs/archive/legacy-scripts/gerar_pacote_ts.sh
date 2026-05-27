#!/bin/bash
ARQUIVO_SAIDA="pacote_rlsys_ts.log"
echo "=== AUDITORIA RLSYS (NODE/TS) ===" > $ARQUIVO_SAIDA

# Procura ficheiros .ts e .js, ignorando node_modules, pastas de build e git
find . -type f \( -name "*.ts" -o -name "*.js" \) -not -path "*/node_modules/*" -not -path "*/dist/*" -not -path "*/build/*" -not -path "*/.git/*" | while read -r arquivo; do
    echo -e "\n\n=========================================" >> $ARQUIVO_SAIDA
    echo "📍 ARQUIVO: $arquivo" >> $ARQUIVO_SAIDA
    echo "=========================================" >> $ARQUIVO_SAIDA
    cat "$arquivo" >> $ARQUIVO_SAIDA
done

# Copia para a pasta Downloads para facilitar o upload
cp $ARQUIVO_SAIDA /sdcard/Download/
echo "[SUCESSO] Pacote TypeScript gerado e copiado para Downloads: $ARQUIVO_SAIDA"
