// Configuração global para testes

// Aumentar o timeout para testes
jest.setTimeout(30000);

// Mock do console para evitar poluição nos logs de teste
global.console = {
  ...console,
  // Desativar logs durante os testes
  log: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Configurar variáveis de ambiente para testes
process.env.NODE_ENV = 'test';
process.env.JWT_SECRET = 'test-secret-key';
process.env.PORT = '5000';

// Limpar todos os mocks após cada teste
afterEach(() => {
  jest.clearAllMocks();
});