'use strict';

const fs = require('node:fs');
const path = require('node:path');

/**
 * Adaptador de Infraestrutura para Persistência do Capital.
 * Garante a continuidade do Juros Compostos entre as sessões.
 */
class FileBankrollRepository {
  constructor() {
    this.filePath = path.join(process.cwd(), 'data', 'financial', 'bankroll-state.json');
  }

  load() {
    try {
      if (fs.existsSync(this.filePath)) {
        const data = JSON.parse(fs.readFileSync(this.filePath, 'utf8'));
        return data.bankroll;
      }
      return null;
    } catch (error) {
      return null; // Fail-safe: Se corromper, retorna nulo para solicitar setup manual.
    }
  }

  save(bankroll) {
    try {
      const payload = JSON.stringify({ 
        bankroll: parseFloat(bankroll.toFixed(2)), 
        lastUpdated: new Date().toISOString() 
      });
      // Escrita síncrona O(1) otimizada para não travar o loop de eventos no Termux
      fs.writeFileSync(this.filePath, payload, 'utf8');
    } catch (error) {
      // Degradação silenciosa segura, a sessão atual continua operando em RAM
    }
  }
}

module.exports = { FileBankrollRepository };
