import { describe, it, expect } from 'vitest';
import { CommandParser } from '../../../src/application/terminal/CommandParser';

describe('CommandParser', () => {
    it('should parse valid commands correctly', () => {
        const cmd = CommandParser.parse('sync');
        expect(cmd.commandName).toBe('sync');
        expect(cmd.args.length).toBe(0);
        expect(cmd.rawCommand).toBe('sync');
    });

    it('should parse commands with arguments', () => {
        const cmd = CommandParser.parse('setbankroll 1000');
        expect(cmd.commandName).toBe('setbankroll');
        expect(cmd.args).toEqual(['1000']);
    });

    it('should throw error for unknown commands', () => {
        expect(() => CommandParser.parse('invalid_cmd')).toThrow(/Comando desconhecido/);
    });

    it('should throw error for empty input', () => {
        expect(() => CommandParser.parse('   ')).toThrow(/Comando vazio/);
    });

    it('should validate setbankroll arguments', () => {
        expect(() => CommandParser.parse('setbankroll -50')).toThrow(/Sintaxe inválida/);
        expect(() => CommandParser.parse('setbankroll abc')).toThrow(/Sintaxe inválida/);
    });
});
