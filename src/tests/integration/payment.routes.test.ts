import request from 'supertest';
import app from '../../app';
import * as paymentService from '../../services/firebasePaymentService';
import * as creditCardPaymentService from '../../services/firebaseCreditCardPaymentService';
import * as pixPaymentService from '../../services/firebasePixPaymentService';
import * as userPlanService from '../../services/firebaseUserPlanService';
import * as couponService from '../../services/firebaseCouponService';
import { FirebasePaymentStatus, FirebasePaymentMethod } from '../../types/firebaseTypes'; // Alterado para firebaseTypes e adicionado FirebasePaymentMethod
import { Timestamp } from 'firebase-admin/firestore';
import { generateAuthToken } from '../../utils/auth';

// Mock dos serviços
jest.mock('../../services/firebasePaymentService');
jest.mock('../../services/firebaseCreditCardPaymentService');
jest.mock('../../services/firebasePixPaymentService');
jest.mock('../../services/firebaseUserPlanService');
jest.mock('../../services/firebaseCouponService');
jest.mock('../../utils/auth');

describe('Payment Routes', () => {
  let mockUserToken: string;
  let mockAdminToken: string;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock de tokens
    mockUserToken = 'user-token';
    mockAdminToken = 'admin-token';

    // Mock da função de geração de token
    (generateAuthToken as jest.Mock).mockImplementation((userId, role) => {
      if (role === 'ADMIN') return mockAdminToken;
      return mockUserToken;
    });
  });

  describe('POST /api/payments', () => {
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
        paymentMethod: FirebasePaymentMethod.PIX, // Corrigido
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const mockPixPayment = {
        id: 'pix1',
        paymentId: 'payment1',
        amount: 100,
        status: 'PENDING', // Manter como string se for específico do mock do PIX service
        pixCopiaECola: 'pix-code',
        qrCodeUrl: 'qr-url',
        expirationDate: Timestamp.now()
      };

      // Setup mocks
      (userPlanService.getPlanById as jest.Mock).mockResolvedValue(mockPlan);
      (userPlanService.getUserActivePlans as jest.Mock).mockResolvedValue([]);
      (paymentService.createPayment as jest.Mock).mockResolvedValue(mockPayment);
      (pixPaymentService.createPixPayment as jest.Mock).mockResolvedValue(mockPixPayment);

      // Fazer a requisição
      const response = await request(app)
        .post('/api/payments')
        .set('Authorization', `Bearer ${mockUserToken}`)
        .send({
          planId: 'plan1',
          paymentMethod: 'pix'
        });

      // Verificar resultado
      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payment');
      expect(response.body.data).toHaveProperty('pixPayment');
      expect(paymentService.createPayment).toHaveBeenCalled();
      expect(pixPaymentService.createPixPayment).toHaveBeenCalled();
    });

    it('deve retornar erro 401 quando não autenticado', async () => {
      // Fazer a requisição sem token
      const response = await request(app)
        .post('/api/payments')
        .send({
          planId: 'plan1',
          paymentMethod: 'pix'
        });

      // Verificar resultado
      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/payments/:paymentId', () => {
    it('deve retornar um pagamento específico', async () => {
      // Configurar mocks
      const mockPayment = {
        id: 'payment1',
        userId: 'user1',
        planId: 'plan1',
        amount: 100,
        status: FirebasePaymentStatus.PENDING,
        paymentMethod: FirebasePaymentMethod.PIX, // Corrigido
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

      // Fazer a requisição
      const response = await request(app)
        .get('/api/payments/payment1')
        .set('Authorization', `Bearer ${mockUserToken}`);

      // Verificar resultado
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveProperty('payment');
      expect(response.body.data).toHaveProperty('paymentDetails');
      expect(response.body.data.payment.id).toBe('payment1');
    });

    it('deve retornar erro 404 quando o pagamento não existir', async () => {
      // Setup mocks
      (paymentService.getPaymentById as jest.Mock).mockResolvedValue(null);

      // Fazer a requisição
      const response = await request(app)
        .get('/api/payments/pagamento-inexistente')
        .set('Authorization', `Bearer ${mockUserToken}`);

      // Verificar resultado
      expect(response.status).toBe(404);
      expect(response.body.success).toBe(false);
    });
  });

  describe('GET /api/payments/user/me', () => {
    it('deve retornar os pagamentos do usuário autenticado', async () => {
      // Configurar mocks
      const mockPayments = [
        {
          id: 'payment1',
          userId: 'user1',
          planId: 'plan1',
          amount: 100,
          status: FirebasePaymentStatus.APPROVED,
          paymentMethod: FirebasePaymentMethod.PIX, // Corrigido
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        },
        {
          id: 'payment2',
          userId: 'user1',
          planId: 'plan2',
          amount: 200,
          status: FirebasePaymentStatus.PENDING,
          paymentMethod: FirebasePaymentMethod.CREDIT_CARD, // Corrigido
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        }
      ];

      // Setup mocks
      (paymentService.getPaymentsByUserId as jest.Mock).mockResolvedValue(mockPayments);

      // Fazer a requisição
      const response = await request(app)
        .get('/api/payments/user/me')
        .set('Authorization', `Bearer ${mockUserToken}`);

      // Verificar resultado
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
      expect(response.body.data[0].id).toBe('payment1');
      expect(response.body.data[1].id).toBe('payment2');
    });
  });

  describe('GET /api/payments', () => {
    it('deve retornar todos os pagamentos para admin', async () => {
      // Configurar mocks
      const mockPayments = [
        {
          id: 'payment1',
          userId: 'user1',
          planId: 'plan1',
          amount: 100,
          status: FirebasePaymentStatus.APPROVED,
          paymentMethod: FirebasePaymentMethod.PIX, // Corrigido
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        },
        {
          id: 'payment2',
          userId: 'user2',
          planId: 'plan2',
          amount: 200,
          status: FirebasePaymentStatus.PENDING,
          paymentMethod: FirebasePaymentMethod.CREDIT_CARD, // Corrigido
          createdAt: Timestamp.now(),
          updatedAt: Timestamp.now()
        }
      ];

      // Setup mocks
      // Verifica se getAllPayments existe antes de mockar
      // O método getAllPayments não existe no paymentService.
      // TODO: Implementar uma função como listPayments no paymentService com filtros adequados para admin
      // e ajustar este teste para mockar e usar essa nova função.
      // Exemplo de mock para uma futura função listPayments:
      // (paymentService.listPayments as jest.Mock).mockResolvedValue({ payments: mockPayments, nextPageStartAfter: undefined, total: mockPayments.length });
      // Por agora, o teste para esta rota pode não funcionar como esperado.

      // Fazer a requisição
      const response = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${mockAdminToken}`);

      // Verificar resultado
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toHaveLength(2);
    });

    it('deve retornar erro 403 quando usuário não-admin tentar acessar', async () => {
      // Fazer a requisição
      const response = await request(app)
        .get('/api/payments')
        .set('Authorization', `Bearer ${mockUserToken}`);

      // Verificar resultado
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('PUT /api/payments/:paymentId/status', () => {
    it('deve atualizar o status de um pagamento (admin)', async () => {
      // Configurar mocks
      const mockPayment = {
        id: 'payment1',
        userId: 'user1',
        planId: 'plan1',
        amount: 100,
        status: FirebasePaymentStatus.PENDING,
        paymentMethod: FirebasePaymentMethod.PIX, // Corrigido
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      };

      const mockUpdatedPayment = {
        ...mockPayment,
        status: FirebasePaymentStatus.APPROVED,
        paidAt: Timestamp.now()
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
      (paymentService.updatePayment as jest.Mock).mockResolvedValue(mockUpdatedPayment);
      (pixPaymentService.getPixPaymentByPaymentId as jest.Mock).mockResolvedValue(mockPixPayment);
      (pixPaymentService.approvePixPayment as jest.Mock).mockResolvedValue({
        ...mockPixPayment,
        status: 'APPROVED'
      });

      // Fazer a requisição
      const response = await request(app)
        .put('/api/payments/payment1/status')
        .set('Authorization', `Bearer ${mockAdminToken}`)
        .send({
          status: FirebasePaymentStatus.APPROVED
        });

      // Verificar resultado
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(FirebasePaymentStatus.APPROVED);
      expect(paymentService.updatePayment).toHaveBeenCalled();
      expect(pixPaymentService.approvePixPayment).toHaveBeenCalled();
    });

    it('deve retornar erro 403 quando usuário não-admin tentar atualizar', async () => {
      // Fazer a requisição
      const response = await request(app)
        .put('/api/payments/payment1/status')
        .set('Authorization', `Bearer ${mockUserToken}`)
        .send({
          status: FirebasePaymentStatus.APPROVED
        });

      // Verificar resultado
      expect(response.status).toBe(403);
      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/payments/:paymentId/refund', () => {
    it('deve processar um reembolso com sucesso', async () => {
      // Configurar mocks
      const mockPayment = {
        id: 'payment1',
        userId: 'user1',
        planId: 'plan1',
        amount: 100,
        status: FirebasePaymentStatus.APPROVED,
        paymentMethod: FirebasePaymentMethod.CREDIT_CARD, // Corrigido
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

      // Fazer a requisição
      const response = await request(app)
        .post('/api/payments/payment1/refund')
        .set('Authorization', `Bearer ${mockUserToken}`)
        .send({
          reason: 'Insatisfação com o serviço'
        });

      // Verificar resultado
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data.status).toBe(FirebasePaymentStatus.REFUNDED);
      expect(paymentService.refundPayment).toHaveBeenCalled();
      expect(creditCardPaymentService.refundCreditCardPayment).toHaveBeenCalled();
    });
  });

  describe('GET /api/payments/methods/available', () => {
    it('deve retornar os métodos de pagamento disponíveis', async () => {
      // Fazer a requisição
      const response = await request(app)
        .get('/api/payments/methods/available')
        .set('Authorization', `Bearer ${mockUserToken}`);

      // Verificar resultado
      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeInstanceOf(Array);
      expect(response.body.data.length).toBeGreaterThan(0);
      // Ajustar para verificar o formato esperado { id: string, name: string }
      expect(response.body.data.some((m: any) => m.id === FirebasePaymentMethod.CREDIT_CARD && m.name === 'Cartão de Crédito')).toBe(true);
      expect(response.body.data.some((m: any) => m.id === FirebasePaymentMethod.PIX && m.name === 'PIX')).toBe(true);
    });
  });

  describe('POST /api/payments/webhook', () => {
    it('deve processar um webhook de pagamento com sucesso', async () => {
      // Configurar mocks
      const mockPayment = {
        id: 'payment1',
        userId: 'user1',
        planId: 'plan1',
        amount: 100,
        status: FirebasePaymentStatus.PENDING,
        paymentMethod: FirebasePaymentMethod.PIX, // Corrigido
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
      (pixPaymentService.approvePixPayment as jest.Mock).mockResolvedValue({
        ...mockPixPayment,
        status: 'APPROVED'
      });

      // Fazer a requisição
      const response = await request(app)
        .post('/api/payments/webhook')
        .set('Content-Type', 'application/json')
        .send({
          type: 'payment.succeeded',
          data: {
            payment_id: 'payment1',
            transaction_id: 'trans123',
            end_to_end_id: 'e2e123',
            status: 'paid'
          }
        });

      // Verificar resultado
      expect(response.status).toBe(200);
      expect(response.body.received).toBe(true);
      expect(pixPaymentService.approvePixPayment).toHaveBeenCalled();
    });
  });
});

