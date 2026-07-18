import { AIRequest, AIResponse } from '../contracts';
import { AIProviderRegistry } from '../providers/AIProviderRegistry';

export class AIGateway {
  constructor(private readonly providerRegistry: AIProviderRegistry) {}

  async execute(request: AIRequest, providerName?: string): Promise<AIResponse> {
    const provider = providerName 
      ? this.providerRegistry.getProvider(providerName)
      : this.providerRegistry.getDefaultProvider();

    if (!provider) {
      return {
        content: '',
        isSuccess: false,
        errors: [{
          code: 'NO_PROVIDER',
          message: providerName 
            ? `Provider ${providerName} not found` 
            : 'No default provider available'
        }]
      };
    }

    return provider.execute(request);
  }
}
