export interface AIRequest {
  readonly prompt: string;
  readonly context?: Readonly<Record<string, unknown>>;
  readonly options?: Readonly<{
    maxTokens?: number;
    temperature?: number;
    topP?: number;
  }>;
}
