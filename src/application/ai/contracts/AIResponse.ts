export interface AIResponse {
  readonly content: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
  readonly isSuccess: boolean;
  readonly errors?: ReadonlyArray<{
    code: string;
    message: string;
  }>;
}
