import PDFDocument from 'pdfkit';
import { Readable } from 'stream';
import { FirebasePayment } from '../../types/firebaseTypes';
import { storage } from '../../config/firebaseAdmin';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface InvoiceData {
  payment: FirebasePayment;
  userDetails?: {
    name: string;
    email: string;
    document?: string;
    address?: string;
    postalCode?: string; // Adicionado
    city?: string;       // Adicionado
    state?: string;      // Adicionado
  };
  companyDetails: {
    name: string;
    document: string;
    address: string;
    logo?: string;
  };
  items: Array<{
    description: string;
    amount: number;
    quantity: number;
  }>;
  discounts?: Array<{
    description: string;
    amount: number;
  }>;
}

/**
 * Gera um PDF de fatura para um pagamento
 * @param invoiceData Dados da fatura
 * @returns URL do arquivo PDF gerado
 */
export const generateInvoicePDF = async (invoiceData: InvoiceData): Promise<string> => {
  const { payment, userDetails, companyDetails, items, discounts } = invoiceData;
  
  // Criar um novo documento PDF
  const doc = new PDFDocument({
    size: 'A4',
    margin: 50,
    info: {
      Title: `Fatura #INV-${payment.id}`,
      Author: companyDetails.name,
      Subject: 'Fatura de pagamento',
      Keywords: 'fatura, pagamento, medforum'
    }
  });
  
  // Criar um stream para o PDF
  const chunks: Buffer[] = [];
  const pdfStream = new Readable();
  
  // Capturar os chunks do PDF
  doc.on('data', (chunk) => {
    chunks.push(chunk);
  });
  
  // Quando o PDF estiver finalizado
  const pdfPromise = new Promise<Buffer>((resolve) => {
    doc.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
  });
  
  // Adicionar conteúdo ao PDF
  
  // Cabeçalho
  doc.fontSize(20).text('FATURA', { align: 'center' });
  doc.moveDown();
  
  // Informações da empresa
  doc.fontSize(12).text(companyDetails.name, { align: 'left' });
  doc.fontSize(10).text(`CNPJ: ${companyDetails.document}`, { align: 'left' });
  doc.text(companyDetails.address, { align: 'left' });
  doc.moveDown();
  
  // Informações da fatura
  doc.fontSize(12).text(`Fatura #INV-${payment.id}`, { align: 'right' });
  const paidDate = payment.paidAt?.toDate() || new Date();
  doc.fontSize(10).text(`Data: ${format(paidDate, 'dd/MM/yyyy', { locale: ptBR })}`, { align: 'right' });
  doc.moveDown();
  
  // Informações do cliente
  doc.fontSize(12).text('Cliente:', { align: 'left' });
  doc.fontSize(10).text(userDetails?.name || 'Cliente', { align: 'left' });
  doc.text(userDetails?.email || 'Email não disponível', { align: 'left' });
  if (userDetails?.document) {
    doc.text(`CPF/CNPJ: ${userDetails.document}`, { align: 'left' });
  }
  if (userDetails?.address) {
    doc.text(userDetails.address, { align: 'left' });
  }
  doc.moveDown(2);
  
  // Tabela de itens
  const tableTop = doc.y;
  const tableHeaders = ['Descrição', 'Quantidade', 'Valor Unitário', 'Total'];
  const tableWidths = [300, 60, 80, 80];
  
  // Cabeçalho da tabela
  doc.fontSize(10).font('Helvetica-Bold');
  let xPosition = 50;
  tableHeaders.forEach((header, i) => {
    doc.text(header, xPosition, tableTop, { width: tableWidths[i], align: i > 0 ? 'right' : 'left' });
    xPosition += tableWidths[i];
  });
  
  // Linha separadora
  doc.moveTo(50, tableTop + 20).lineTo(550, tableTop + 20).stroke();
  
  // Itens
  doc.font('Helvetica');
  let yPosition = tableTop + 30;
  
  items.forEach(item => {
    xPosition = 50;
    
    // Descrição
    doc.text(item.description, xPosition, yPosition, { width: tableWidths[0], align: 'left' });
    xPosition += tableWidths[0];
    
    // Quantidade
    doc.text(item.quantity.toString(), xPosition, yPosition, { width: tableWidths[1], align: 'right' });
    xPosition += tableWidths[1];
    
    // Valor unitário
    doc.text(formatCurrency(item.amount / item.quantity), xPosition, yPosition, { width: tableWidths[2], align: 'right' });
    xPosition += tableWidths[2];
    
    // Total
    doc.text(formatCurrency(item.amount), xPosition, yPosition, { width: tableWidths[3], align: 'right' });
    
    yPosition += 20;
  });
  
  // Linha separadora
  doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
  yPosition += 20;
  
  // Descontos (se houver)
  if (discounts && discounts.length > 0) {
    discounts.forEach(discount => {
      doc.text(discount.description, 50, yPosition, { width: tableWidths[0] + tableWidths[1] + tableWidths[2], align: 'left' });
      doc.text(`- ${formatCurrency(discount.amount)}`, 430, yPosition, { width: tableWidths[3], align: 'right' });
      yPosition += 20;
    });
    
    // Linha separadora
    doc.moveTo(50, yPosition).lineTo(550, yPosition).stroke();
    yPosition += 20;
  }
  
  // Total
  doc.font('Helvetica-Bold');
  doc.text('Total', 50, yPosition, { width: tableWidths[0] + tableWidths[1] + tableWidths[2], align: 'left' });
  doc.text(formatCurrency(payment.amount), 430, yPosition, { width: tableWidths[3], align: 'right' });
  
  // Método de pagamento
  yPosition += 40;
  doc.font('Helvetica');
  doc.text(`Método de pagamento: ${formatPaymentMethod(payment.paymentMethod)}`, 50, yPosition);
  
  // Status
  yPosition += 20;
  doc.text(`Status: Pago`, 50, yPosition);
  
  // Data de pagamento
  yPosition += 20;
  doc.text(`Data de pagamento: ${format(paidDate, 'dd/MM/yyyy HH:mm', { locale: ptBR })}`, 50, yPosition);
  
  // Rodapé
  doc.fontSize(8);
  const bottomPosition = doc.page.height - 50;
  doc.text('Este documento é uma representação digital da fatura. Não possui valor fiscal.', 50, bottomPosition, { align: 'center' });
  
  // Finalizar o documento
  doc.end();
  
  // Aguardar a finalização do PDF
  const pdfBuffer = await pdfPromise;
  
  // Salvar o PDF no Firebase Storage
  const fileName = `invoices/${payment.userId}/${payment.id}.pdf`;
  const fileRef = storage.bucket().file(fileName);
  
  await fileRef.save(pdfBuffer, {
    metadata: {
      contentType: 'application/pdf',
      metadata: {
        paymentId: payment.id,
        userId: payment.userId,
        generatedAt: new Date().toISOString()
      }
    }
  });
  
  // Configurar acesso público (ou usar token de acesso temporário em produção)
  await fileRef.makePublic();
  
  // Retornar a URL do arquivo
  return `https://storage.googleapis.com/${storage.bucket().name}/${fileName}`;
};

/**
 * Formata um valor monetário
 */
const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  }).format(value);
};

/**
 * Formata o método de pagamento para exibição
 */
const formatPaymentMethod = (method: string): string => {
  const methods = {
    'credit_card': 'Cartão de Crédito',
    'pix': 'PIX',
    'bank_slip': 'Boleto Bancário'
  };
  
  return methods[method as keyof typeof methods] || method;
};