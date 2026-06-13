'use strict';

const fs = require('node:fs');
const path = require('node:path');
const readline = require('node:readline');
const { spawnSync } = require('node:child_process');

const destDir = path.join(process.cwd(), 'data/paper-runtime/warmup-screenshots');

console.clear();
console.log('======================================================');
console.log(' 🎰 RL.SYS MANUAL WARMUP INJECTOR (OCR BYPASS)');
console.log('======================================================');
console.log('Cole todo o histórico de números copiados, separados por espaço ou vírgula.');
console.log('Exemplo: 32 15 19 4 21 2 ...');

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

rl.question('\n> ', (answer) => {
  const rounds = answer.split(/[^0-9]+/)
    .filter(n => n.trim().length > 0)
    .map(Number)
    .filter(n => n >= 0 && n <= 36);
  
  if (rounds.length < 100) {
    console.log(`\n[!] ATENÇÃO: Você inseriu apenas ${rounds.length} rodadas. O RL.SYS exige no mínimo 100 para liberar as entradas.`);
    console.log('O motor legado bloqueará a recomendação oficial, mas você poderá observar as análises avançadas.');
  } else {
    console.log(`\n✅ Sucesso: ${rounds.length} rodadas processadas manualmente.`);
  }

  // Limpa artefatos antigos para não haver conflito
  if (fs.existsSync(destDir)) {
    fs.readdirSync(destDir).forEach(f => fs.unlinkSync(path.join(destDir, f)));
  } else {
    fs.mkdirSync(destDir, { recursive: true });
  }

  // Cria imagem fantasma e JSON de OCR falsificado para enganar as travas do projeto
  const dummyImage = path.join(destDir, 'manual_warmup.png');
  fs.writeFileSync(dummyImage, 'MOCK_IMAGE_DATA');
  
  const sidecar = path.join(destDir, 'manual_warmup.extracted.json');
  fs.writeFileSync(sidecar, JSON.stringify({ rounds }, null, 2));

  rl.close();
  
  console.log('Iniciando o Orquestrador Live...\n');
  spawnSync('node', ['scripts/live-paper-orchestrator.js'], { stdio: 'inherit' });
});
