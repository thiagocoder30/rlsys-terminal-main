import type { AIRequest } from './AIRequest';
import type { AIResponse } from './AIResponse';

export interface AIProvider {
  readonly name: string;

  execute(
    request: AIRequest
  ): Promise<AIResponse>;
}
