# RELATORIO TECNICO - SPRINT 017

## Objetivo
Adicionar uma camada de hardening de entrada para impedir que payloads corrompidos, grandes demais, suspeitos ou semanticamente inválidos entrem nos motores quantitativos do RL.SYS Core.

## Decisão arquitetural
A Sprint introduz o `InputHardeningEngine` como componente puro de domínio. Ele não depende de HTTP, filesystem, banco de dados, Android, Termux, OCR vendor ou UI. Infraestrutura e adapters continuam responsáveis por coletar dados; o domínio passa a receber payloads desconhecidos e produzir uma decisão auditável de aceitação, sanitização, revisão ou rejeição.

## Entregas
- `InputHardeningEngine`
- Política `lowEndAndroidPolicy` para Helio P22 / 2GB RAM
- Inspeção iterativa sem recursão
- Detecção de limite de profundidade, campos, arrays e bytes estimados
- Detecção de tokens suspeitos
- Detecção de chaves de prototype pollution
- Validação de valores de roleta para OCR/manual
- Preview sanitizado e limitado para UI/log
- Checksum de auditoria determinístico
- Testes unitários para payload seguro, valor inválido, token suspeito, sanitização, excesso de array e erro tipado

## Complexidade
- Tempo: O(n), onde n é o número de nós inspecionados dentro dos limites da política.
- Espaço: O(n) no pior caso pelo stack iterativo, também limitado pela política.

## Governança
A Sprint não autoriza apostas, não altera banca e não executa decisão operacional. Ela protege o pipeline antes que dados não confiáveis alimentem OCR, warm-up, sessão live, event bus, persistência ou decisão.

## Resultado esperado
O RL.SYS passa a ter uma barreira de entrada auditável e compatível com hardware limitado, reduzindo risco de corrupção silenciosa, payloads maliciosos e falhas por consumo excessivo de memória.
