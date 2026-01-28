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
 * Simple text wrapping function
 */
function wrapText(text: string, maxCharsPerLine: number): string[] {
  const words = text.split(' ');
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      if (currentLine) {
        lines.push(currentLine);
      }
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }

  return lines;
}

/**
 * Generates a PDF document from the provided content
 * @param content - The text content to include in the PDF
 * @param options - Optional PDF configuration
 * @returns A jsPDF document instance
 */
export function generatePdf(content: string, options?: PdfOptions): jsPDF {
  // Filter out undefined values from options to prevent overriding defaults
  const filteredOptions: PdfOptions = {};
  if (options) {
    if (options.title !== undefined) filteredOptions.title = options.title;
    if (options.fontSize !== undefined) filteredOptions.fontSize = options.fontSize;
    if (options.lineHeight !== undefined) filteredOptions.lineHeight = options.lineHeight;
    if (options.margins !== undefined) filteredOptions.margins = options.margins;
  }
  const opts = { ...DEFAULT_OPTIONS, ...filteredOptions };

  // Ensure numeric values are valid
  const fontSize = typeof opts.fontSize === 'number' && !isNaN(opts.fontSize) ? opts.fontSize : 12;
  const lineHeight = typeof opts.lineHeight === 'number' && !isNaN(opts.lineHeight) ? opts.lineHeight : 1.5;
  const margins = opts.margins || DEFAULT_OPTIONS.margins;

  // Ensure content is a valid string and clean it
  const safeContent = (content || '').replace(/[^\x20-\x7E\n\r\t äöüÄÖÜß]/g, '');

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
  });

  const pageHeight = doc.internal.pageSize.getHeight();

  // Approximate characters per line for A4 at font size 12
  const maxCharsPerLine = 80;

  let currentY = margins.top;

  // Add title
  if (opts.title) {
    doc.setFontSize(fontSize + 4);
    doc.text(String(opts.title), margins.left, currentY);
    currentY += 10;
  }

  // Add content
  doc.setFontSize(fontSize);

  // Handle empty content
  if (!safeContent.trim()) {
    doc.text('(No content)', margins.left, currentY);
    return doc;
  }

  const lineSpacing = fontSize * 0.352778 * lineHeight;

  // Split by newlines first, then wrap each paragraph
  const paragraphs = safeContent.split(/\n/);

  for (const paragraph of paragraphs) {
    const lines = wrapText(paragraph, maxCharsPerLine);

    for (const line of lines) {
      if (currentY + lineSpacing > pageHeight - margins.bottom) {
        doc.addPage();
        currentY = margins.top;
      }
      doc.text(String(line), margins.left, currentY);
      currentY += lineSpacing;
    }

    // Add extra spacing between paragraphs
    currentY += lineSpacing * 0.5;
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
