import { generateInvoicePDF } from "../../../utils/pdf/invoiceGenerator";
import { FirebasePayment, FirebasePaymentStatus, FirebasePaymentMethod } from "../../../types/firebaseTypes"; // Added FirebasePaymentStatus and FirebasePaymentMethod
import { Timestamp } from "firebase-admin/firestore";

// Mock das dependências
jest.mock("../../../config/firebaseAdmin", () => {
  return {
    storage: {
      bucket: jest.fn().mockReturnValue({
        name: "test-bucket",
        file: jest.fn().mockReturnValue({
          save: jest.fn().mockResolvedValue({}),
          makePublic: jest.fn().mockResolvedValue({}),
        }),
      }),
    },
  };
});

// Mock do PDFDocument
const mockPdfInstance = {
  listeners: {} as Record<string, any>,
  on: jest.fn(function(this: any, event: string, callback: any) { // Changed to function to allow 'this'
    mockPdfInstance.listeners[event] = callback;
    if (event === "end" && mockPdfInstance.listeners["end"]) { // Auto-trigger end for simplicity in test
        // Simular emissão de dados e finalização
        const mockBuffer = Buffer.from("mock pdf content");
        if (mockPdfInstance.listeners["data"]) {
            mockPdfInstance.listeners["data"](mockBuffer);
        }
        mockPdfInstance.listeners["end"]();
    }
    return this; 
  }),
  fontSize: jest.fn().mockReturnThis(),
  text: jest.fn().mockReturnThis(),
  moveDown: jest.fn().mockReturnThis(),
  font: jest.fn().mockReturnThis(),
  moveTo: jest.fn().mockReturnThis(),
  lineTo: jest.fn().mockReturnThis(),
  stroke: jest.fn().mockReturnThis(),
  end: jest.fn().mockImplementation(() => {
    // This will now be triggered by the 'on' mock if event is 'end'
  }),
  page: {
    height: 842,
  },
};

jest.mock("pdfkit", () => {
  return jest.fn().mockImplementation(() => mockPdfInstance);
});

describe("Invoice PDF Generator", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset listeners for each test
    mockPdfInstance.listeners = {};
    // Reset mock function calls for pdfkit instance methods
    mockPdfInstance.on.mockClear();
    mockPdfInstance.fontSize.mockClear();
    mockPdfInstance.text.mockClear();
    mockPdfInstance.moveDown.mockClear();
    mockPdfInstance.font.mockClear();
    mockPdfInstance.moveTo.mockClear();
    mockPdfInstance.lineTo.mockClear();
    mockPdfInstance.stroke.mockClear();
    mockPdfInstance.end.mockClear();
  });

  it("should generate a PDF invoice and return a URL", async () => {
    // Mock dos dados
    const mockTimestamp = Timestamp.fromDate(new Date());

    const mockPayment: FirebasePayment = {
      id: "test-payment-id",
      userId: "test-user-id",
      planId: "test-plan-id",
      originalAmount: 100,
      discountAmount: 0,
      amount: 100,
      currency: "BRL",
      status: FirebasePaymentStatus.APPROVED, // Corrected
      paymentMethod: FirebasePaymentMethod.CREDIT_CARD, // Corrected
      description: "Assinatura Premium",
      paidAt: mockTimestamp,
      createdAt: mockTimestamp,
      updatedAt: mockTimestamp,
    };

    const invoiceData = {
      payment: mockPayment,
      userDetails: {
        name: "Test User",
        email: "test@example.com",
        document: "123.456.789-00",
        address: "Rua Teste, 123",
      },
      companyDetails: {
        name: "MedForum Educação Médica Ltda",
        document: "12.345.678/0001-90",
        address: "Av. Paulista, 1000, São Paulo - SP, CEP 01310-100",
      },
      items: [
        {
          description: "Assinatura Premium",
          amount: 100,
          quantity: 1,
        },
      ],
      discounts: [
        {
          description: "Cupom: TESTE10",
          amount: 10,
        },
      ],
    };

    const result = await generateInvoicePDF(invoiceData);

    // Verificar se a URL foi retornada corretamente
    expect(result).toBe(
      `https://storage.googleapis.com/test-bucket/invoices/${mockPayment.userId}/${mockPayment.id}.pdf`
    );

    // Verificar se o arquivo foi salvo no Storage
    const { storage } = require("../../../config/firebaseAdmin");
    const bucket = storage.bucket();
    const file = bucket.file(
      `invoices/${mockPayment.userId}/${mockPayment.id}.pdf`
    );

    expect(bucket.file).toHaveBeenCalledWith(
      `invoices/${mockPayment.userId}/${mockPayment.id}.pdf`
    );
    expect(file.save).toHaveBeenCalled();
    expect(file.makePublic).toHaveBeenCalled();
    expect(mockPdfInstance.end).toHaveBeenCalled(); // Ensure PDF generation was finalized
  });
});

