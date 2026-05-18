"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WheelTopology = void 0;
class WheelTopology {
    /**
     * Obtém os vizinhos físicos de um número em tempo O(1) com alocação mínima.
     */
    static getCluster(target, size) {
        if (size % 2 === 0 || size < 1 || size > 37) {
            throw new Error("O tamanho do cluster deve ser ímpar (ex: 3, 5, 7).");
        }
        const targetIndex = this.SEQUENCE.indexOf(target);
        if (targetIndex === -1)
            throw new Error("Número alvo inválido.");
        const cluster = new Array(size);
        const sideNeighbors = Math.floor(size / 2);
        let insertPos = 0;
        for (let i = -sideNeighbors; i <= sideNeighbors; i++) {
            let neighborIndex = (targetIndex + i) % 37;
            if (neighborIndex < 0) {
                neighborIndex += 37;
            }
            cluster[insertPos++] = this.SEQUENCE[neighborIndex];
        }
        return cluster;
    }
    static isHit(result, cluster) {
        for (let i = 0; i < cluster.length; i++) {
            if (cluster[i] === result)
                return true;
        }
        return false;
    }
}
exports.WheelTopology = WheelTopology;
// Sequência física padrão da Roleta Europeia
WheelTopology.SEQUENCE = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23,
    10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
];
