"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const AIGateway_1 = require("../../application/ai/gateway/AIGateway");
const AIProviderRegistry_1 = require("../../application/ai/providers/AIProviderRegistry");
describe('AIGateway', () => {
    class MockProvider {
        constructor(name, response) {
            this.name = name;
            this.response = response;
        }
        async execute(request) {
            return this.response;
        }
    }
    let registry;
    let gateway;
    beforeEach(() => {
        registry = new AIProviderRegistry_1.AIProviderRegistry();
        gateway = new AIGateway_1.AIGateway(registry);
    });
    test('should route to default provider', async () => {
        const mockResponse = {
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
        const mockResponse = {
            content: 'specific',
            isSuccess: true
        };
        const provider = new MockProvider('specific', mockResponse);
        registry.registerProvider(provider);
        const response = await gateway.execute({ prompt: 'test' }, 'specific');
        expect(response).toEqual(mockResponse);
    });
});
