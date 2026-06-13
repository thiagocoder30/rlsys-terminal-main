'use strict';

const { spawn } = require('node:child_process');

/**
 * Adaptador de Infraestrutura para Termux TTS.
 * Desacopla o motor de síntese de voz das regras de negócio.
 * Otimizado O(1) com Fire-and-Forget para não bloquear o Event Loop.
 */
class TermuxTtsVoiceCopilot {
  /**
   * @param {string} message - Mensagem a ser sintetizada.
   * @returns {Object} Result pattern
   */
  speak(message) {
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return { ok: false, error: 'Mensagem inválida ou vazia.' };
    }

    try {
      // Cria um processo filho desanexado.
      // Isso permite que o Node.js continue rodando sem esperar o fim do áudio.
      const proc = spawn('termux-tts-speak', [message], { 
        stdio: 'ignore', 
        detached: true 
      });

      // Oculta erros caso a API do Termux falhe, garantindo Fail-Safe
      proc.on('error', () => {
        // Silencioso. Degrada para modo texto.
      });

      // Remove a referência do processo filho para não prender o Node.js
      proc.unref();

      return { ok: true };
    } catch (error) {
      return { ok: false, error: error.message || 'Falha ao acionar TTS.' };
    }
  }
}

module.exports = { TermuxTtsVoiceCopilot };
