import { Request, Response } from 'express';
import { validationResult } from 'express-validator';
import * as categoryService from '../../services/firebaseCategoryService';
import { AppError } from '../../utils/errors';
import { UserRole } from '../../types/firebaseTypes';

/**
 * Controlador para operações relacionadas a categorias
 *
 * Responsável por gerenciar categorias para organização de conteúdo
 */
class CategoryController {
  /**
   * Verifica se o usuário está autenticado
   *
   * @private
   * @param {Request} req - Objeto de requisição
   * @returns {string} - ID do usuário autenticado
   * @throws {AppError} - Se o usuário não estiver autenticado
   */
  private getAuthenticatedUserId(req: Request): string {
    const userId = req.user?.id;
    if (!userId) {
      throw new AppError('Usuário não autenticado', 401);
    }
    return userId;
  }

  /**
   * Cria uma nova categoria (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async createCategory(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { name, description, icon, color, parentId, isActive } = req.body;
      
      // Verificar se já existe uma categoria com o mesmo nome
      const existingCategory = await categoryService.getCategoryByName(name);
      if (existingCategory) {
        throw new AppError('Já existe uma categoria com este nome', 409);
      }
      
      // Se parentId for fornecido, verificar se a categoria pai existe
      if (parentId) {
        const parentCategory = await categoryService.getCategoryById(parentId);
        if (!parentCategory) {
          throw new AppError('Categoria pai não encontrada', 404);
        }
      }
      
      const categoryData = {
        name,
        description: description || '',
        icon: icon || null,
        color: color || '#000000',
        parentId: parentId || null,
        isActive: isActive !== false,
        createdAt: new Date(),
        createdBy: req.user.id
      };
      
      const category = await categoryService.createCategory(categoryData);
      
      res.status(201).json({
        success: true,
        message: 'Categoria criada com sucesso',
        data: category
      });
    } catch (error: any) {
      console.error('Erro ao criar categoria:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao criar categoria'
      });
    }
  }

  /**
   * Obtém todas as categorias
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getAllCategories(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true' && req.user?.role === UserRole.ADMIN;
      const hierarchical = req.query.hierarchical === 'true';
      
      const categories = await categoryService.getAllCategories(includeInactive, hierarchical);
      
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error: any) {
      console.error('Erro ao obter categorias:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter categorias'
      });
    }
  }

  /**
   * Obtém uma categoria pelo ID
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getCategoryById(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      
      const category = await categoryService.getCategoryById(categoryId);
      
      if (!category) {
        throw new AppError('Categoria não encontrada', 404);
      }
      
      // Se a categoria estiver inativa e o usuário não for admin, não permitir acesso
      if (!category.isActive && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Categoria não encontrada', 404);
      }
      
      res.status(200).json({
        success: true,
        data: category
      });
    } catch (error: any) {
      console.error(`Erro ao obter categoria ID ${req.params.categoryId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter categoria'
      });
    }
  }

  /**
   * Atualiza uma categoria (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async updateCategory(req: Request, res: Response): Promise<void> {
    try {
      // Validar entrada
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        res.status(400).json({ success: false, errors: errors.array() });
        return;
      }
      
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { categoryId } = req.params;
      const { name, description, icon, color, parentId, isActive } = req.body;
      
      // Verificar se a categoria existe
      const existingCategory = await categoryService.getCategoryById(categoryId);
      if (!existingCategory) {
        throw new AppError('Categoria não encontrada', 404);
      }
      
      // Verificar se já existe outra categoria com o mesmo nome
      if (name && name !== existingCategory.name) {
        const categoryWithSameName = await categoryService.getCategoryByName(name);
        if (categoryWithSameName && categoryWithSameName.id !== categoryId) {
          throw new AppError('Já existe uma categoria com este nome', 409);
        }
      }
      
      // Se parentId for fornecido, verificar se a categoria pai existe
      if (parentId && parentId !== existingCategory.parentId) {
        // Não permitir que uma categoria seja sua própria pai ou avó
        if (parentId === categoryId) {
          throw new AppError('Uma categoria não pode ser sua própria pai', 400);
        }
        
        const parentCategory = await categoryService.getCategoryById(parentId);
        if (!parentCategory) {
          throw new AppError('Categoria pai não encontrada', 404);
        }
        
        // Verificar se a categoria pai não é uma subcategoria desta categoria
        const isSubcategory = await categoryService.isSubcategoryOf(parentId, categoryId);
        if (isSubcategory) {
          throw new AppError('Não é possível criar uma referência circular na hierarquia de categorias', 400);
        }
      }
      
      const categoryData = {
        name,
        description,
        icon,
        color,
        parentId,
        isActive,
        updatedAt: new Date(),
        updatedBy: req.user.id
      };
      
      const updatedCategory = await categoryService.updateCategory(categoryId, categoryData);
      
      res.status(200).json({
        success: true,
        message: 'Categoria atualizada com sucesso',
        data: updatedCategory
      });
    } catch (error: any) {
      console.error(`Erro ao atualizar categoria ID ${req.params.categoryId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao atualizar categoria'
      });
    }
  }

  /**
   * Exclui uma categoria (apenas para administradores)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async deleteCategory(req: Request, res: Response): Promise<void> {
    try {
      // Verificar se o usuário é administrador
      if (req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Acesso não autorizado', 403);
      }
      
      const { categoryId } = req.params;
      
      // Verificar se a categoria existe
      const existingCategory = await categoryService.getCategoryById(categoryId);
      if (!existingCategory) {
        throw new AppError('Categoria não encontrada', 404);
      }
      
      // Verificar se a categoria tem subcategorias
      const hasSubcategories = await categoryService.hasSubcategories(categoryId);
      if (hasSubcategories) {
        throw new AppError('Não é possível excluir uma categoria que possui subcategorias', 400);
      }
      
      // Verificar se a categoria está sendo usada em algum conteúdo
      const isCategoryInUse = await categoryService.isCategoryInUse(categoryId);
      if (isCategoryInUse) {
        throw new AppError('Não é possível excluir uma categoria que está sendo usada', 400);
      }
      
      await categoryService.deleteCategory(categoryId);
      
      res.status(200).json({
        success: true,
        message: 'Categoria excluída com sucesso'
      });
    } catch (error: any) {
      console.error(`Erro ao excluir categoria ID ${req.params.categoryId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao excluir categoria'
      });
    }
  }

  /**
   * Obtém as subcategorias de uma categoria
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getSubcategories(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      const includeInactive = req.query.includeInactive === 'true' && req.user?.role === UserRole.ADMIN;
      
      // Verificar se a categoria existe
      const existingCategory = await categoryService.getCategoryById(categoryId);
      if (!existingCategory) {
        throw new AppError('Categoria não encontrada', 404);
      }
      
      // Se a categoria estiver inativa e o usuário não for admin, não permitir acesso
      if (!existingCategory.isActive && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Categoria não encontrada', 404);
      }
      
      const subcategories = await categoryService.getSubcategories(categoryId, includeInactive);
      
      res.status(200).json({
        success: true,
        data: subcategories
      });
    } catch (error: any) {
      console.error(`Erro ao obter subcategorias da categoria ID ${req.params.categoryId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter subcategorias'
      });
    }
  }

  /**
   * Obtém as categorias de nível superior (sem pai)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getRootCategories(req: Request, res: Response): Promise<void> {
    try {
      const includeInactive = req.query.includeInactive === 'true' && req.user?.role === UserRole.ADMIN;
      
      const rootCategories = await categoryService.getRootCategories(includeInactive);
      
      res.status(200).json({
        success: true,
        data: rootCategories
      });
    } catch (error: any) {
      console.error('Erro ao obter categorias de nível superior:', error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter categorias de nível superior'
      });
    }
  }

  /**
   * Obtém o caminho completo de uma categoria (da raiz até a categoria)
   *
   * @param {Request} req - Objeto de requisição
   * @param {Response} res - Objeto de resposta
   * @returns {Promise<void>}
   */
  async getCategoryPath(req: Request, res: Response): Promise<void> {
    try {
      const { categoryId } = req.params;
      
      // Verificar se a categoria existe
      const existingCategory = await categoryService.getCategoryById(categoryId);
      if (!existingCategory) {
        throw new AppError('Categoria não encontrada', 404);
      }
      
      // Se a categoria estiver inativa e o usuário não for admin, não permitir acesso
      if (!existingCategory.isActive && req.user?.role !== UserRole.ADMIN) {
        throw new AppError('Categoria não encontrada', 404);
      }
      
      const path = await categoryService.getCategoryPath(categoryId);
      
      res.status(200).json({
        success: true,
        data: path
      });
    } catch (error: any) {
      console.error(`Erro ao obter caminho da categoria ID ${req.params.categoryId}:`, error);
      const statusCode = error instanceof AppError ? error.statusCode : 500;
      res.status(statusCode).json({
        success: false,
        message: error.message || 'Erro ao obter caminho da categoria'
      });
    }
  }
}

export default new CategoryController();