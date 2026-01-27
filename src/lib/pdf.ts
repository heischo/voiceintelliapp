// PDF Generation Module - Uses jsPDF for generating PDF documents

import { jsPDF } from 'jspdf';

export interface PdfOptions {
  title?: string;
  fontSize?: number;
  lineHeight?: number;
  margins?: {
    top: number;
    right: number;
    bottom: number;
    left: number;
  };
}

const DEFAULT_OPTIONS: Required<PdfOptions> = {
  title: 'Transcript',
  fontSize: 12,
  lineHeight: 1.5,
  margins: {
    top: 20,
    right: 20,
    bottom: 20,
    left: 20,
  },
};

/**
 * Generates a PDF document from the provided content
 * @param content - The text content to include in the PDF
 * @param options - Optional PDF configuration
 * @returns A jsPDF document instance
 */
export function generatePdf(content: string, options?: PdfOptions): jsPDF {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const contentWidth = pageWidth - opts.margins.left - opts.margins.right;

  // Add title
  if (opts.title) {
    doc.setFontSize(opts.fontSize + 4);
    doc.setFont('helvetica', 'bold');
    doc.text(opts.title, opts.margins.left, opts.margins.top);
  }

  // Add content
  doc.setFontSize(opts.fontSize);
  doc.setFont('helvetica', 'normal');

  const startY = opts.title ? opts.margins.top + 10 : opts.margins.top;
  const lines = doc.splitTextToSize(content, contentWidth);

  let currentY = startY;
  const lineSpacing = opts.fontSize * 0.352778 * opts.lineHeight; // Convert pt to mm

  for (const line of lines) {
    if (currentY + lineSpacing > pageHeight - opts.margins.bottom) {
      doc.addPage();
      currentY = opts.margins.top;
    }
    doc.text(line, opts.margins.left, currentY);
    currentY += lineSpacing;
  }

  return doc;
}

/**
 * Converts a PDF document to a Uint8Array for file writing
 * @param doc - The jsPDF document instance
 * @returns Uint8Array containing the PDF binary data
 */
export function pdfToUint8Array(doc: jsPDF): Uint8Array {
  const arrayBuffer = doc.output('arraybuffer');
  return new Uint8Array(arrayBuffer);
}

/**
 * Generates a PDF and returns it as a Uint8Array
 * @param content - The text content to include in the PDF
 * @param options - Optional PDF configuration
 * @returns Uint8Array containing the PDF binary data
 */
export function generatePdfAsBytes(content: string, options?: PdfOptions): Uint8Array {
  const doc = generatePdf(content, options);
  return pdfToUint8Array(doc);
}
