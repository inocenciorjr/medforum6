import winston from 'winston';
import config from '../config';

// Configuração do logger
const logger = winston.createLogger({
  level: config.logging.level,
  format: winston.format.combine(
    winston.format.timestamp({
      format: 'YYYY-MM-DD HH:mm:ss'
    }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    winston.format.json()
  ),
  defaultMeta: { service: 'medforum-api' },
  transports: [
    // Console transport sempre ativo
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
        )
      )
    })
  ]
});

// Adicionar transporte de arquivo se configurado
if (config.logging.file) {
  logger.add(
    new winston.transports.File({
      filename: config.logging.file,
      format: winston.format.combine(
        winston.format.printf(
          info => `${info.timestamp} ${info.level}: ${info.message}${info.stack ? '\n' + info.stack : ''}`
        )
      )
    })
  );
}

export { logger };