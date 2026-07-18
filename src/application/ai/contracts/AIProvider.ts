import { AIRequest, AIResponse } from './';

export interface AIProvider {
  readonly name: string;
  execute(request: AIRequest): Promise<AIResponse>;
}
