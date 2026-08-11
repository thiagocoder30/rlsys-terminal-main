export interface RuntimeAdapter<TInput, TOutput> {
    execute(input: TInput): Promise<TOutput>;
}
