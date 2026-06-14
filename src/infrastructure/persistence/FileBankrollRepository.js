'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Repositório Avançado de Persistência.
 * Salva todo o estado da máquina de risco para evitar bypass por reinicialização.
 */
class FileBankrollRepository {
  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'financial', 'bankroll-state.json');
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        return JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  save(statePayload) {
    try {
      const payload = JSON.stringify({
        ...statePayload,
        lastUpdated: new Date().toISOString()
      }, null, 2);
      fs.writeFileSync(this.filePath, payload, 'utf8');
    } catch (error) {
      // Fail-safe passivo
    }
  }
}

module.exports = { FileBankrollRepository };
