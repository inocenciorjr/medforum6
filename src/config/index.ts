import dotenv from 'dotenv';

// Carrega variáveis de ambiente do arquivo .env
dotenv.config();

/**
 * Função auxiliar para obter variáveis de ambiente como número, com valor padrão.
 * @param key - A chave da variável de ambiente.
 * @param defaultValue - O valor padrão a ser usado se a variável não estiver definida ou for inválida.
 * @returns O valor numérico da variável de ambiente ou o valor padrão.
 */
const getEnvVarAsNumber = (key: string, defaultValue: number): number => {
  const value = process.env[key];
  if (value === undefined || value === null || value.trim() === '') {
    return defaultValue;
  }
  const parsedValue = parseInt(value, 10);
  return isNaN(parsedValue) ? defaultValue : parsedValue;
};

/**
 * Função auxiliar para obter variáveis de ambiente como array de strings.
 * @param key - A chave da variável de ambiente.
 * @param defaultValue - O valor padrão (array de strings) a ser usado.
 * @param separator - O separador usado na string da variável de ambiente (padrão: ',').
 * @returns O array de strings.
 */
const getEnvVarAsArray = (key: string, defaultValue: string[], separator: string = ','): string[] => {
  const value = process.env[key];
  if (value === undefined || value === null || value.trim() === '') {
    return defaultValue;
  }
  return value.split(separator).map(item => item.trim());
};

// Define a interface para a configuração da aplicação
interface AppConfig {
  port: number;
  env: string;
  environment: string;
  apiPrefix: string;
  corsOrigins: string[] | string;
  bodyParserLimit: string;
  rateLimitWindowMs: number;
  rateLimitMax: number;
  version: string;
  apiUrl: string;
  frontendUrl: string;
}

interface LoggingConfig {
  level: string;
  file?: string;
}

interface PaginationConfig {
  defaultLimit: number;
  maxLimit: number;
}

interface UploadConfig {
  maxSizeMb: number;
  allowedTypes: string[];
  storageDir: string;
  tmpDir: string;
}

interface CacheConfig {
  ttlSeconds: number;
  checkPeriodSeconds: number;
}

// Estrutura completa da configuração
interface Config {
  app: AppConfig;
  logging: LoggingConfig;
  pagination: PaginationConfig;
  upload: UploadConfig;
  cache: CacheConfig;
}

const config: Config = {
  app: {
    port: getEnvVarAsNumber('PORT', 5000),
    env: process.env.NODE_ENV || 'development',
    environment: process.env.NODE_ENV || 'development',
    apiPrefix: process.env.API_PREFIX || '/api',
    corsOrigins: process.env.CORS_ORIGINS ? (process.env.CORS_ORIGINS === '*' ? '*' : getEnvVarAsArray('CORS_ORIGINS', ['*'])) : ['*'],
    bodyParserLimit: process.env.BODY_PARSER_LIMIT || '10mb',
    rateLimitWindowMs: getEnvVarAsNumber('RATE_LIMIT_WINDOW_MINUTES', 15) * 60 * 1000,
    rateLimitMax: getEnvVarAsNumber('RATE_LIMIT_MAX_REQUESTS', 100),
    version: process.env.APP_VERSION || '1.0.0',
    apiUrl: process.env.API_URL || `http://localhost:${getEnvVarAsNumber("PORT", 5000)}`,
    frontendUrl: process.env.FRONTEND_URL || "http://localhost:3000"
  },
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    file: process.env.LOG_FILE || undefined
  },
  pagination: {
    defaultLimit: getEnvVarAsNumber('DEFAULT_PAGINATION_LIMIT', 10),
    maxLimit: getEnvVarAsNumber('MAX_PAGINATION_LIMIT', 100)
  },
  upload: {
    maxSizeMb: getEnvVarAsNumber("MAX_UPLOAD_SIZE_MB", 50),
    allowedTypes: getEnvVarAsArray("ALLOWED_UPLOAD_TYPES", [".pdf"]),
    storageDir: process.env.UPLOAD_STORAGE_DIR || "uploads/",
    tmpDir: process.env.UPLOAD_TMP_DIR || "/tmp/uploads"
  },
  cache: {
    ttlSeconds: getEnvVarAsNumber('CACHE_TTL_SECONDS', 3600),
    checkPeriodSeconds: getEnvVarAsNumber('CACHE_CHECK_PERIOD_SECONDS', 600)
  }
};

export default config;