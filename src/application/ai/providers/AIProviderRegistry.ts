import { AIProvider } from '../contracts/AIProvider';

export class AIProviderRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private defaultProvider?: string;

  registerProvider(provider: AIProvider, isDefault = false): void {
    this.providers.set(provider.name, provider);
    if (isDefault) {
      this.defaultProvider = provider.name;
    }
  }

  getProvider(name: string): AIProvider | undefined {
    return this.providers.get(name);
  }

  getDefaultProvider(): AIProvider | undefined {
    return this.defaultProvider 
      ? this.providers.get(this.defaultProvider)
      : undefined;
  }

  listProviders(): ReadonlyArray<string> {
    return Array.from(this.providers.keys());
  }
}
