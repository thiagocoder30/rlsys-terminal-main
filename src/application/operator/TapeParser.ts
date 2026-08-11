export class TapeParser {
    public static parse(input: string): ReadonlyArray<number> {
        if (!input || input.trim().length === 0) {
            return Object.freeze([]);
        }

        const tokens = input.replace(/\n/g, ' ').replace(/\t/g, ' ').split(/\s+/).filter(t => t.trim() !== '');
        const numbers: number[] = [];

        for (const token of tokens) {
            const num = parseInt(token, 10);
            if (isNaN(num) || num < 0 || num > 36) {
                throw new Error(`Invalid tape token detected: ${token}. Only numbers between 0 and 36 are allowed.`);
            }
            numbers.push(num);
        }

        return Object.freeze(numbers);
    }
}
