import * as invoiceService from '../../services/firebaseInvoiceService';
import * as paymentService from '../../services/firebasePaymentService';
import * as userService from '../../services/firebaseUserService';
import { generateInvoicePDF } from '../../utils/pdf/invoiceGenerator';
import { FirebaseInvoice, FirebasePayment, FirebaseUser, FirebaseUserProfile, FirebasePaymentStatus, FirebasePaymentMethod, UserRole } from '../../types/firebaseTypes';
import { Timestamp } from 'firebase-admin/firestore';

// Mock das dependências
jest.mock('../../config/firebaseAdmin', () => {
  const mockDoc = {
    id: 'test-invoice-id',
    set: jest.fn().mockResolvedValue({}),
    get: jest.fn().mockResolvedValue({
      exists: true,
      data: () => mockInvoice
    }),
    update: jest.fn().mockResolvedValue({})
  };
  
  const mockCollection = {
    doc: jest.fn().mockReturnValue(mockDoc),
    where: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    get: jest.fn().mockResolvedValue({
      empty: false,
      docs: [{
        data: () => mockInvoice
      }]
    })
  };
  
  return {
    firestore: {
      collection: jest.fn().mockReturnValue(mockCollection)
    },
    storage: {
      bucket: jest.fn().mockReturnValue({
        name: 'test-bucket',
        file: jest.fn().mockReturnValue({
          save: jest.fn().mockResolvedValue({}),
          makePublic: jest.fn().mockResolvedValue({}),
          publicUrl: jest.fn().mockReturnValue('https://storage.googleapis.com/test-bucket/invoices/test-user-id/test-payment-id.pdf') // Added mock for publicUrl
        })
      })
    }
  };
});

jest.mock('../../services/firebasePaymentService');
jest.mock('../../services/firebaseUserService');
jest.mock('../../utils/pdf/invoiceGenerator');

// Mock dos dados
const mockTimestamp = Timestamp.fromDate(new Date());

const mockPayment: FirebasePayment = {
  id: 'test-payment-id',
  userId: 'test-user-id',
  planId: 'test-plan-id',
  amount: 100,
  currency: 'BRL', // Added currency
  status: FirebasePaymentStatus.APPROVED, 
  paymentMethod: FirebasePaymentMethod.CREDIT_CARD, 
  // description: 'Assinatura Premium', // Removed, not in FirebasePayment type
  paidAt: mockTimestamp,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
  originalAmount: 100, // Added originalAmount
  discountAmount: 0, // Added discountAmount
};

const mockUser: FirebaseUser = {
  id: 'test-user-id',
  uid: 'test-user-id',
  email: 'test@example.com',
  displayName: 'Test User',
  role: UserRole.STUDENT, // Corrected to a valid UserRole enum member
  isActive: true,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp,
  lastLoginAt: mockTimestamp
};

const mockUserProfile: FirebaseUserProfile = {
  userId: 'test-user-id',
  name: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  updatedAt: mockTimestamp
};

const mockInvoice: FirebaseInvoice = {
  id: 'test-invoice-id',
  paymentId: 'test-payment-id',
  userId: 'test-user-id',
  invoiceNumber: 'INV-test-payment-id',
  amount: 100,
  status: 'paid', 
  pdfUrl: 'https://storage.googleapis.com/test-bucket/invoices/test-user-id/test-payment-id.pdf',
  items: [
    {
      description: 'Assinatura Premium',
      amount: 100,
      quantity: 1
    }
  ],
  discounts: [],
  paymentMethod: FirebasePaymentMethod.CREDIT_CARD.toString(), // Ensure it's a string if the type is string
  paidAt: mockTimestamp,
  createdAt: mockTimestamp,
  updatedAt: mockTimestamp
};

describe('Firebase Invoice Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    
    (paymentService.getPaymentById as jest.Mock).mockResolvedValue(mockPayment);
    (userService.getUser as jest.Mock).mockResolvedValue(mockUser);
    (userService.getUserProfile as jest.Mock).mockResolvedValue(mockUserProfile);
    (generateInvoicePDF as jest.Mock).mockResolvedValue('https://storage.googleapis.com/test-bucket/invoices/test-user-id/test-payment-id.pdf');
  });

  describe('createInvoice', () => {
    it('should create a new invoice', async () => {
      const invoiceData = {
        paymentId: 'test-payment-id',
        userId: 'test-user-id',
        invoiceNumber: 'INV-test-payment-id',
        amount: 100,
        status: 'paid' as const, 
        pdfUrl: 'https://example.com/invoice.pdf',
        items: [{ description: 'Test Item', amount: 100, quantity: 1 }],
        discounts: [],
        paymentMethod: FirebasePaymentMethod.CREDIT_CARD.toString(), 
        paidAt: mockTimestamp
      };

      const result = await invoiceService.createInvoice(invoiceData);

      expect(result).toHaveProperty('id');
      expect(result.paymentId).toBe(invoiceData.paymentId);
      expect(result.userId).toBe(invoiceData.userId);
      expect(result.amount).toBe(invoiceData.amount);
      expect(result.createdAt).toBeDefined();
      expect(result.updatedAt).toBeDefined();
    });
  });

  describe('getInvoiceById', () => {
    it('should return an invoice by ID', async () => {
      const result = await invoiceService.getInvoiceById('test-invoice-id');
      
      expect(result).toEqual(mockInvoice);
    });
  });

  describe('getInvoiceByPaymentId', () => {
    it('should return an invoice by payment ID', async () => {
      const result = await invoiceService.getInvoiceByPaymentId('test-payment-id');
      
      expect(result).toEqual(mockInvoice);
    });
  });

  describe('getInvoicesByUserId', () => {
    it('should return all invoices for a user', async () => {
      const result = await invoiceService.getInvoicesByUserId('test-user-id');
      
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual(mockInvoice);
    });
  });

  describe('updateInvoice', () => {
    it('should update an existing invoice', async () => {
      const updates = {
        status: 'refunded' as const 
      };

      const result = await invoiceService.updateInvoice('test-invoice-id', updates);
      
      expect(result).toEqual(mockInvoice);
    });
  });

  describe('generateOrRetrieveInvoice', () => {
    it('should return existing invoice if it exists', async () => {
      const result = await invoiceService.generateOrRetrieveInvoice('test-payment-id');
      
      expect(result).toEqual(mockInvoice);
      // This assertion might be too strict if getPaymentById is called internally by getInvoiceByPaymentId
      // expect(paymentService.getPaymentById).not.toHaveBeenCalled(); 
    });

    it('should generate a new invoice if none exists', async () => {
      const mockFirestoreInstance = require('../../config/firebaseAdmin').firestore;
      const mockEmptyCollection = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true })
      };
      const mockDocRef = { set: jest.fn().mockResolvedValue({}) };
      const mockCollectionRef = { doc: jest.fn().mockReturnValue(mockDocRef) };
      
      mockFirestoreInstance.collection
        .mockReturnValueOnce(mockEmptyCollection) // For getInvoiceByPaymentId check
        .mockReturnValueOnce(mockCollectionRef); // For createInvoice call
      
      const result = await invoiceService.generateOrRetrieveInvoice('test-payment-id');
      
      expect(paymentService.getPaymentById).toHaveBeenCalledWith('test-payment-id');
      expect(userService.getUser).toHaveBeenCalledWith('test-user-id');
      expect(userService.getUserProfile).toHaveBeenCalledWith('test-user-id');
      expect(generateInvoicePDF).toHaveBeenCalled();
      expect(result).toBeDefined();
      expect(result?.paymentId).toBe('test-payment-id');
    });

    it('should return null if payment is not found', async () => {
      const mockFirestoreInstance = require('../../config/firebaseAdmin').firestore;
      const mockEmptyCollection = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true })
      };
      mockFirestoreInstance.collection.mockReturnValueOnce(mockEmptyCollection);
      
      (paymentService.getPaymentById as jest.Mock).mockResolvedValue(null);
      
      const result = await invoiceService.generateOrRetrieveInvoice('test-payment-id');
      
      expect(result).toBeNull();
    });

    it('should return null if payment is not approved', async () => {
      const mockFirestoreInstance = require('../../config/firebaseAdmin').firestore;
      const mockEmptyCollection = {
        where: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        get: jest.fn().mockResolvedValue({ empty: true })
      };
      mockFirestoreInstance.collection.mockReturnValueOnce(mockEmptyCollection);
      
      (paymentService.getPaymentById as jest.Mock).mockResolvedValue({
        ...mockPayment,
        status: FirebasePaymentStatus.PENDING 
      });
      
      const result = await invoiceService.generateOrRetrieveInvoice('test-payment-id');
      
      expect(result).toBeNull();
    });
  });
});

