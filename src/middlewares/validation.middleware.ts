import { Request, Response, NextFunction } from 'express';
import { validationResult, ValidationChain } from 'express-validator';

/**
 * Middleware para validar requisições usando express-validator
 * @param validations Array de validações do express-validator
 * @returns Middleware que executa as validações e retorna erros se existirem
 */
export const validate = (validations: ValidationChain[]) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    // Executar todas as validações em paralelo
    await Promise.all(validations.map(validation => validation.run(req)));

    // Verificar se há erros de validação
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      // Se não houver erros, passa para o próximo middleware/rota
      return next();
    }

    // Se houver erros, retorna uma resposta 400 com os erros formatados
    return res.status(400).json({
      success: false,
      message: 'Erro de validação',
      errors: errors.array() // Retorna um array com os detalhes dos erros
    });
  };
};