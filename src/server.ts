import app from './app';
import config from './config';
import { logger } from './utils/logger';

const PORT = config.app.port;

// Iniciar o servidor
const server = app.listen(PORT, '0.0.0.0', () => {
  logger.info(`Servidor rodando na porta ${PORT} em modo ${config.app.environment}`);
  logger.info(`API disponível em: ${config.app.apiUrl}`);
});

// Tratamento de encerramento gracioso
const gracefulShutdown = (signal: string) => {
  logger.info(`${signal} recebido. Encerrando servidor...`);
  server.close(() => {
    logger.info('Servidor encerrado.');
    process.exit(0);
  });

  // Se o servidor não encerrar em 10 segundos, forçar encerramento
  setTimeout(() => {
    logger.error('Encerramento forçado após timeout.');
    process.exit(1);
  }, 10000);
};

// Capturar sinais de encerramento
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

export default server;