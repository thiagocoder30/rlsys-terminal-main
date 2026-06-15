export interface IBankrollRepository {
    load(): any | null;
    save(state: any): void;
}
