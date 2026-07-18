import { AIGateway } from '../../application/ai/gateway/AIGateway';
import { AIProviderRegistry } from '../../application/ai/providers/AIProviderRegistry';
import { AIRequest, AIResponse, AIProvider } from '../../application/ai/contracts';

describe('AIGateway', () => {
  class MockProvider implements AIProvider {
    constructor(
      public readonly name: string,
      private readonly response: AIResponse
    ) {}

    async execute(request: AIRequest): Promise<AIResponse> {
      return this.response;
    }
  }

  let registry: AIProviderRegistry;
  let gateway: AIGateway;

  beforeEach(() => {
    registry = new AIProviderRegistry();
    gateway = new AIGateway(registry);
  });

  test('should route to default provider', async () => {
    const mockResponse: AIResponse = {
      content: 'test',
      isSuccess: true
    };
    const provider = new MockProvider('test', mockResponse);
    registry.registerProvider(provider, true);

    const response = await gateway.execute({ prompt: 'test' });
    expect(response).toEqual(mockResponse);
  });

  test('should return error when no providers', async () => {
    const response = await gateway.execute({ prompt: 'test' });
    expect(response.isSuccess).toBe(false);
    expect(response.errors?.[0].code).toBe('NO_PROVIDER');
  });

  test('should route to named provider', async () => {
    const mockResponse: AIResponse = {
      content: 'specific',
      isSuccess: true
    };
    const provider = new MockProvider('specific', mockResponse);
    registry.registerProvider(provider);

    const response = await gateway.execute(
      { prompt: 'test' }, 
      'specific'
    );
    expect(response).toEqual(mockResponse);
  });
});
