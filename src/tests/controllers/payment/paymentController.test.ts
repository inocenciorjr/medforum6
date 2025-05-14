import { Request, Response } from 'express';
import paymentController from '../../../controllers/payment/paymentController';
import * as paymentService from '../../../services/firebasePaymentService';
import * as creditCardPaymentService from '../../../services/firebaseCreditCardPaymentService';
import * as pixPaymentService from '../../../services/firebasePixPaymentService';
import * as userPlanService from '../../../services/firebaseUserPlanService';
import * as couponService from '../../../services/firebaseCouponService';
import { FirebasePaymentStatus } from '../../../types/firebasePaymentTypes';
import { Timestamp } from 'firebase-admin/firestore';
import { AppError } from '../../../utils/errors';
import { UserRole } from '../../../types/firebaseTypes';

// Mock dos serviços
jest.mock('../../../services/firebasePaymentService');
jest.mock('../../../services/firebaseCreditCardPaymentService');
jest.mock('../../../services/firebasePixPaymentService');
jest.mock('../../../services/firebaseUserPlanService');
jest.mock('../../../services/firebaseCouponService');

describe('PaymentController', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let responseObject: any;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Mock de resposta
    responseObject = {};
    mockResponse = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation(result => {
        responseObject = result;
        return mockResponse;
      })
    };
  });

  describe('create', () => {
    it('deve criar um pagamento PIX com sucesso', async () => {
      // Configurar mocks
      const mockPlan = {
        id: 'plan1',
        name: 'Plano Premium',
        price: 100
      };

      const mockPayment = {
        id: 'payment1',
        userId: 'user1',
        planId: 'plan1',
        amount: 100,
        status: FirebasePaymentStatus.PENDING,
        paymentMethod: 'pix',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const mockPixPayment = {
        id: 'pix1',
        paymentId: 'payment1',
        amount: 100,
        status: 'PENDING',
        pixCopiaECola: 'pix-code',
        qrCodeUrl: 'qr-url',
        expirationDate: Timestamp.now()
      };

      // Setup mocks
      (userPlanService as any).getPlanById = jest.fn().mockResolvedValue(mockPlan);
      (userPlanService as any).getUserActivePlans = jest.fn().mockResolvedValue([]);
      (paymentService.createPayment as jest.Mock).mockResolvedValue(mockPayment);
      (pixPaymentService.createPixPayment as jest.Mock).mockResolvedValue(mockPixPayment);

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT },
        body: {
          planId: 'plan1',
          paymentMethod: 'pix'
        }
      };

      // Executar o método
      await paymentController.create(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseObject.success).toBe(true);
      expect(responseObject.data).toHaveProperty('payment');
      expect(responseObject.data).toHaveProperty('pixPayment');
      expect(paymentService.createPayment).toHaveBeenCalled();
      expect(pixPaymentService.createPixPayment).toHaveBeenCalled();
    });

    it('deve criar um pagamento de cartão de crédito com sucesso', async () => {
      // Configurar mocks
      const mockPlan = {
        id: 'plan1',
        name: 'Plano Premium',
        price: 100
      };

      const mockPayment = {
        id: 'payment1',
        userId: 'user1',
        planId: 'plan1',
        amount: 100,
        status: FirebasePaymentStatus.PENDING,
        paymentMethod: 'credit_card',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const mockCCPayment = {
        id: 'cc1',
        paymentId: 'payment1',
        amount: 100,
        status: 'PENDING',
        cardToken: 'token123',
        cardLastFourDigits: '1234',
        cardBrand: 'visa',
        installments: 1
      };

      // Setup mocks
      (userPlanService as any).getPlanById = jest.fn().mockResolvedValue(mockPlan);
      (userPlanService as any).getUserActivePlans = jest.fn().mockResolvedValue([]);
      (paymentService.createPayment as jest.Mock).mockResolvedValue(mockPayment);
      (creditCardPaymentService.createCreditCardPayment as jest.Mock).mockResolvedValue(mockCCPayment);
      (creditCardPaymentService.authorizeCreditCardPayment as jest.Mock).mockResolvedValue({...mockCCPayment, status: 'AUTHORIZED'});
      (creditCardPaymentService.captureCreditCardPayment as jest.Mock).mockResolvedValue({...mockCCPayment, status: 'CAPTURED'});
      (creditCardPaymentService.getCreditCardPaymentById as jest.Mock).mockResolvedValue({...mockCCPayment, status: 'CAPTURED'});
      (paymentService.getPaymentById as jest.Mock).mockResolvedValue({...mockPayment, status: FirebasePaymentStatus.APPROVED});

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT },
        body: {
          planId: 'plan1',
          paymentMethod: 'credit_card',
          paymentDetails: {
            cardToken: 'token123',
            cardLastFourDigits: '1234',
            cardBrand: 'visa',
            installments: 1
          }
        }
      };

      // Executar o método
      await paymentController.create(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseObject.success).toBe(true);
      expect(responseObject.data).toHaveProperty('payment');
      expect(responseObject.data).toHaveProperty('creditCardPayment');
      expect(paymentService.createPayment).toHaveBeenCalled();
      expect(creditCardPaymentService.createCreditCardPayment).toHaveBeenCalled();
      expect(creditCardPaymentService.authorizeCreditCardPayment).toHaveBeenCalled();
      expect(creditCardPaymentService.captureCreditCardPayment).toHaveBeenCalled();
    });

    it('deve aplicar desconto de cupom quando fornecido', async () => {
      // Configurar mocks
      const mockPlan = {
        id: 'plan1',
        name: 'Plano Premium',
        price: 100
      };

      const mockCoupon = {
        id: 'coupon1',
        code: 'DESCONTO20',
        discountType: 'PERCENTAGE',
        discountValue: 20,
        isActive: true,
        expirationDate: Timestamp.fromDate(new Date(Date.now() + 86400000))
      };

      const mockPayment = {
        id: 'payment1',
        userId: 'user1',
        planId: 'plan1',
        amount: 80, // Com desconto
        status: FirebasePaymentStatus.PENDING,
        paymentMethod: 'pix',
        couponCode: 'DESCONTO20',
        couponDiscount: 20,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const mockPixPayment = {
        id: 'pix1',
        paymentId: 'payment1',
        amount: 80,
        status: 'PENDING',
        pixCopiaECola: 'pix-code',
        qrCodeUrl: 'qr-url',
        expirationDate: Timestamp.now()
      };

      // Setup mocks
      (userPlanService as any).getPlanById = jest.fn().mockResolvedValue(mockPlan);
      (userPlanService as any).getUserActivePlans = jest.fn().mockResolvedValue([]);
      (couponService.validateCoupon as jest.Mock).mockResolvedValue({ valid: true, coupon: mockCoupon });
      (couponService as any).calculateDiscount = jest.fn().mockReturnValue({ discountAmount: 20, finalAmount: 80 });
      (paymentService.createPayment as jest.Mock).mockResolvedValue(mockPayment);
      (pixPaymentService.createPixPayment as jest.Mock).mockResolvedValue(mockPixPayment);

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT },
        body: {
          planId: 'plan1',
          paymentMethod: 'pix',
          couponCode: 'DESCONTO20'
        }
      };

      // Executar o método
      await paymentController.create(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(201);
      expect(responseObject.success).toBe(true);
      expect(responseObject.data.payment.amount).toBe(80);
      expect(responseObject.data.payment.couponCode).toBe('DESCONTO20');
      expect(responseObject.data.payment.couponDiscount).toBe(20);
      expect(couponService.validateCoupon).toHaveBeenCalledWith('DESCONTO20', 'plan1');
      expect((couponService as any).calculateDiscount).toHaveBeenCalled();
    });

    it('deve retornar erro quando o plano não for encontrado', async () => {
      // Setup mocks
      (userPlanService as any).getPlanById = jest.fn().mockResolvedValue(null);

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT },
        body: {
          planId: 'plan-inexistente',
          paymentMethod: 'pix'
        }
      };

      // Executar o método
      await paymentController.create(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(responseObject.success).toBe(false);
      expect(responseObject.message).toContain('Plano não encontrado');
    });

    it('deve retornar erro quando o usuário já tiver o plano ativo', async () => {
      // Configurar mocks
      const mockPlan = {
        id: 'plan1',
        name: 'Plano Premium',
        price: 100
      };

      const mockUserPlan = {
        id: 'userplan1',
        userId: 'user1',
        planId: 'plan1',
        isActive: true
      };

      // Setup mocks
      (userPlanService as any).getPlanById = jest.fn().mockResolvedValue(mockPlan);
      (userPlanService as any).getUserActivePlans = jest.fn().mockResolvedValue([mockUserPlan]);
      
      // Simular o erro diretamente
      (userPlanService as any).getUserActivePlans = jest.fn().mockImplementation(() => {
        throw AppError.badRequest("Você já possui este plano ativo.");
      });

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT },
        body: {
          planId: 'plan1',
          paymentMethod: 'pix'
        }
      };

      // Executar o método
      await paymentController.create(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseObject.success).toBe(false);
      expect(responseObject.message).toContain('Você já possui este plano ativo');
    });
  });

  describe('findById', () => {
    it('deve retornar um pagamento PIX por ID', async () => {
      // Configurar mocks
      const mockPayment = {
        id: 'payment1',
        userId: 'user1',
        planId: 'plan1',
        amount: 100,
        status: FirebasePaymentStatus.PENDING,
        paymentMethod: 'pix',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const mockPixPayment = {
        id: 'pix1',
        paymentId: 'payment1',
        amount: 100,
        status: 'PENDING',
        pixCopiaECola: 'pix-code',
        qrCodeUrl: 'qr-url',
        expirationDate: Timestamp.now()
      };

      // Setup mocks
      (paymentService.getPaymentById as jest.Mock).mockResolvedValue(mockPayment);
      (pixPaymentService.getPixPaymentByPaymentId as jest.Mock).mockResolvedValue(mockPixPayment);

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT },
        params: { paymentId: 'payment1' }
      };

      // Executar o método
      await paymentController.findById(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject.success).toBe(true);
      expect(responseObject.data).toHaveProperty('payment');
      expect(responseObject.data).toHaveProperty('paymentDetails');
      expect(responseObject.data.payment.id).toBe('payment1');
      expect(responseObject.data.paymentDetails.id).toBe('pix1');
    });

    it('deve retornar erro quando o pagamento não for encontrado', async () => {
      // Setup mocks
      (paymentService.getPaymentById as jest.Mock).mockResolvedValue(null);

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT },
        params: { paymentId: 'payment-inexistente' }
      };

      // Executar o método
      await paymentController.findById(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(responseObject.success).toBe(false);
      expect(responseObject.message).toContain('Pagamento não encontrado');
    });

    it('deve retornar erro quando o usuário tentar acessar pagamento de outro usuário', async () => {
      // Configurar mocks
      const mockPayment = {
        id: 'payment1',
        userId: 'outro-usuario',
        planId: 'plan1',
        amount: 100,
        status: FirebasePaymentStatus.PENDING,
        paymentMethod: 'pix',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // Setup mocks
      (paymentService.getPaymentById as jest.Mock).mockResolvedValue(mockPayment);

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT },
        params: { paymentId: 'payment1' }
      };

      // Executar o método
      await paymentController.findById(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(403);
      expect(responseObject.success).toBe(false);
      expect(responseObject.message).toContain('Você não tem permissão');
    });

    it('deve permitir que admin acesse pagamento de qualquer usuário', async () => {
      // Configurar mocks
      const mockPayment = {
        id: 'payment1',
        userId: 'outro-usuario',
        planId: 'plan1',
        amount: 100,
        status: FirebasePaymentStatus.PENDING,
        paymentMethod: 'pix',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // Setup mocks
      (paymentService.getPaymentById as jest.Mock).mockResolvedValue(mockPayment);

      // Setup request
      mockRequest = {
        user: { id: 'admin1', role: UserRole.ADMIN },
        params: { paymentId: 'payment1' }
      };

      // Executar o método
      await paymentController.findById(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject.success).toBe(true);
      expect(responseObject.data.payment.id).toBe('payment1');
    });
  });

  describe('findByUser', () => {
    it('deve retornar os pagamentos do usuário autenticado', async () => {
      // Configurar mocks
      const mockPayments = [
        {
          id: 'payment1',
          userId: 'user1',
          planId: 'plan1',
          amount: 100,
          status: FirebasePaymentStatus.APPROVED,
          paymentMethod: 'pix',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        },
        {
          id: 'payment2',
          userId: 'user1',
          planId: 'plan2',
          amount: 200,
          status: FirebasePaymentStatus.PENDING,
          paymentMethod: 'credit_card',
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        }
      ];

      // Setup mocks
      (paymentService.getPaymentsByUserId as jest.Mock).mockResolvedValue(mockPayments);

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT }
      };

      // Executar o método
      await paymentController.findByUser(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject.success).toBe(true);
      expect(responseObject.data).toHaveLength(2);
      expect(responseObject.data[0].id).toBe('payment1');
      expect(responseObject.data[1].id).toBe('payment2');
    });
  });

  describe('refund', () => {
    it('deve processar um reembolso com sucesso', async () => {
      // Configurar mocks
      const mockPayment = {
        id: 'payment1',
        userId: 'user1',
        planId: 'plan1',
        amount: 100,
        status: FirebasePaymentStatus.APPROVED,
        paymentMethod: 'credit_card',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const mockRefundedPayment = {
        ...mockPayment,
        status: FirebasePaymentStatus.REFUNDED,
        refundReason: 'Insatisfação com o serviço',
        refundedAt: Timestamp.now()
      };

      const mockCCPayment = {
        id: 'cc1',
        paymentId: 'payment1',
        amount: 100,
        status: 'CAPTURED',
        cardToken: 'token123',
        cardLastFourDigits: '1234',
        cardBrand: 'visa',
        installments: 1
      };

      // Setup mocks
      (paymentService.getPaymentById as jest.Mock).mockResolvedValue(mockPayment);
      (paymentService.refundPayment as jest.Mock).mockResolvedValue(mockRefundedPayment);
      (creditCardPaymentService.getCreditCardPaymentByPaymentId as jest.Mock).mockResolvedValue(mockCCPayment);
      (creditCardPaymentService.refundCreditCardPayment as jest.Mock).mockResolvedValue({
        ...mockCCPayment,
        status: 'REFUNDED'
      });

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT },
        params: { paymentId: 'payment1' },
        body: { reason: 'Insatisfação com o serviço' }
      };

      // Executar o método
      await paymentController.refund(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(200);
      expect(responseObject.success).toBe(true);
      expect(responseObject.data.status).toBe(FirebasePaymentStatus.REFUNDED);
      expect(paymentService.refundPayment).toHaveBeenCalledWith('payment1', 'Insatisfação com o serviço');
      expect(creditCardPaymentService.refundCreditCardPayment).toHaveBeenCalled();
    });

    it('deve retornar erro quando o pagamento não for encontrado', async () => {
      // Setup mocks
      (paymentService.getPaymentById as jest.Mock).mockResolvedValue(null);

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT },
        params: { paymentId: 'payment-inexistente' },
        body: { reason: 'Insatisfação com o serviço' }
      };

      // Executar o método
      await paymentController.refund(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(404);
      expect(responseObject.success).toBe(false);
      expect(responseObject.message).toContain('Pagamento não encontrado');
    });

    it('deve retornar erro quando o pagamento não estiver aprovado', async () => {
      // Configurar mocks
      const mockPayment = {
        id: 'payment1',
        userId: 'user1',
        planId: 'plan1',
        amount: 100,
        status: FirebasePaymentStatus.PENDING,
        paymentMethod: 'credit_card',
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      // Setup mocks
      (paymentService.getPaymentById as jest.Mock).mockResolvedValue(mockPayment);

      // Setup request
      mockRequest = {
        user: { id: 'user1', role: UserRole.STUDENT },
        params: { paymentId: 'payment1' },
        body: { reason: 'Insatisfação com o serviço' }
      };

      // Executar o método
      await paymentController.refund(mockRequest as Request, mockResponse as Response);

      // Verificar resultado
      expect(mockResponse.status).toHaveBeenCalledWith(400);
      expect(responseObject.success).toBe(false);
      expect(responseObject.message).toContain('Apenas pagamentos aprovados podem ser reembolsados');
    });
  });

  // Adicione mais testes para outros métodos conforme necessário
});