import { SpinRecord } from './DealerBiasAnalyzer';

export class BoundedSpinBuffer {
  private readonly buffer: SpinRecord[];
  private head: number = 0;
  private isFull: boolean = false;

  constructor(public readonly capacity: number) {
    if (capacity <= 0) throw new Error("A capacidade do buffer deve ser maior que zero.");
    // Pré-alocação estática para evitar crescimento dinâmico na RAM
    this.buffer = new Array<SpinRecord>(capacity);
  }

  /**
   * Inserção O(1) com subscrição automática (Ring Buffer).
   */
  public push(spin: SpinRecord): void {
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
  public toArray(): SpinRecord[] {
    if (!this.isFull) {
      return this.buffer.slice(0, this.head);
    }
    
    const result = new Array<SpinRecord>(this.capacity);
    let insertPos = 0;
    
    for (let i = this.head; i < this.capacity; i++) {
      result[insertPos++] = this.buffer[i];
    }
    for (let i = 0; i < this.head; i++) {
      result[insertPos++] = this.buffer[i];
    }
    
    return result;
  }

  public get length(): number {
    return this.isFull ? this.capacity : this.head;
  }
}
