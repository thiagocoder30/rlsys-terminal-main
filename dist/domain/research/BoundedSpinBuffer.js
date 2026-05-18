"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.BoundedSpinBuffer = void 0;
class BoundedSpinBuffer {
    constructor(capacity) {
        this.capacity = capacity;
        this.head = 0;
        this.isFull = false;
        if (capacity <= 0)
            throw new Error("A capacidade do buffer deve ser maior que zero.");
        // Pré-alocação estática para evitar crescimento dinâmico na RAM
        this.buffer = new Array(capacity);
    }
    /**
     * Inserção O(1) com subscrição automática (Ring Buffer).
     */
    push(spin) {
        this.buffer[this.head] = spin;
        this.head++;
        if (this.head >= this.capacity) {
            this.head = 0;
            this.isFull = true;
        }
    }
    /**
     * Extrai os dados em ordem cronológica (O(N) onde N é o max capacity).
     */
    toArray() {
        if (!this.isFull) {
            return this.buffer.slice(0, this.head);
        }
        const result = new Array(this.capacity);
        let insertPos = 0;
        for (let i = this.head; i < this.capacity; i++) {
            result[insertPos++] = this.buffer[i];
        }
        for (let i = 0; i < this.head; i++) {
            result[insertPos++] = this.buffer[i];
        }
        return result;
    }
    get length() {
        return this.isFull ? this.capacity : this.head;
    }
}
exports.BoundedSpinBuffer = BoundedSpinBuffer;
