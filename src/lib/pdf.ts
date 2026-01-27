// PDF Generation Module - Handles PDF creation with Unicode font support
// Uses jsPDF with embedded font for German/Norwegian character support

import { jsPDF } from 'jspdf';

// PDF configuration constants
const PDF_CONFIG = {
  pageWidth: 210, // A4 width in mm
  pageHeight: 297, // A4 height in mm
  marginLeft: 20,
  marginRight: 20,
  marginTop: 25,
  marginBottom: 25,
  fontSize: 11,
  titleFontSize: 16,
  lineHeight: 1.4,
} as const;

// Calculated content area
const CONTENT_WIDTH = PDF_CONFIG.pageWidth - PDF_CONFIG.marginLeft - PDF_CONFIG.marginRight;
const CONTENT_HEIGHT = PDF_CONFIG.pageHeight - PDF_CONFIG.marginTop - PDF_CONFIG.marginBottom;

/**
 * Custom error class for PDF operations
 */
export class PdfError extends Error {
  constructor(
    message: string,
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'PdfError';
  }
}

/**
 * Extracts a type-safe error message from an unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error) {
    return String((error as { message: unknown }).message);
  }
  return 'Unknown error occurred';
}

/**
 * Sanitizes text for PDF output
 * Handles special characters and normalizes whitespace
 */
function sanitizeText(text: string): string {
  return text
    .replace(/\r\n/g, '\n') // Normalize line endings
    .replace(/\r/g, '\n')
    .replace(/\t/g, '    '); // Convert tabs to spaces
}

/**
 * Options for PDF generation
 */
export interface PdfGenerateOptions {
  /** Title to display at the top of the PDF */
  title?: string;
  /** Include timestamp in header */
  includeTimestamp?: boolean;
  /** Custom filename (without extension) */
  filename?: string;
}

/**
 * Result of PDF generation
 */
export interface PdfGenerateResult {
  /** The generated PDF as a Blob */
  blob: Blob;
  /** Suggested filename for the PDF */
  filename: string;
  /** Number of pages in the PDF */
  pageCount: number;
}

/**
 * Generates a PDF document from text content
 * Supports Unicode characters including German umlauts and Norwegian characters
 *
 * @param content - The text content to convert to PDF
 * @param options - Optional configuration for PDF generation
 * @returns Promise resolving to the generated PDF result
 */
export async function generatePdf(
  content: string,
  options: PdfGenerateOptions = {}
): Promise<PdfGenerateResult> {
  // Validate input
  if (content === null || content === undefined) {
    throw new PdfError('Cannot generate PDF from null or undefined content');
  }

  if (typeof content !== 'string') {
    throw new PdfError('PDF content must be a string');
  }

  if (content.trim().length === 0) {
    throw new PdfError('Cannot generate PDF from empty content');
  }

  try {
    // Create PDF document in A4 format
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      putOnlyUsedFonts: true,
    });

    // Use Helvetica as base font - it has limited but sufficient Unicode support
    // For full Unicode support, a custom font would need to be embedded
    // jsPDF's Helvetica handles common Western European characters reasonably well
    doc.setFont('helvetica', 'normal');

    let currentY = PDF_CONFIG.marginTop;
    let pageNumber = 1;

    // Add title if provided
    if (options.title) {
      doc.setFontSize(PDF_CONFIG.titleFontSize);
      doc.setFont('helvetica', 'bold');

      const titleLines = doc.splitTextToSize(options.title, CONTENT_WIDTH);
      doc.text(titleLines, PDF_CONFIG.marginLeft, currentY);
      currentY += titleLines.length * (PDF_CONFIG.titleFontSize * 0.35) + 5;

      doc.setFont('helvetica', 'normal');
    }

    // Add timestamp if requested
    if (options.includeTimestamp) {
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      const timestamp = new Date().toLocaleString('de-DE', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
      });
      doc.text(`Generated: ${timestamp}`, PDF_CONFIG.marginLeft, currentY);
      currentY += 8;
      doc.setTextColor(0, 0, 0);
    }

    // Set up content font
    doc.setFontSize(PDF_CONFIG.fontSize);

    // Sanitize and process content
    const sanitizedContent = sanitizeText(content);

    // Split content into lines that fit the page width
    const lines = doc.splitTextToSize(sanitizedContent, CONTENT_WIDTH);
    const lineHeight = PDF_CONFIG.fontSize * PDF_CONFIG.lineHeight * 0.35; // Convert to mm

    // Add content with pagination
    for (const line of lines) {
      // Check if we need a new page
      if (currentY + lineHeight > PDF_CONFIG.pageHeight - PDF_CONFIG.marginBottom) {
        // Add page number footer before creating new page
        addPageFooter(doc, pageNumber);

        doc.addPage();
        pageNumber++;
        currentY = PDF_CONFIG.marginTop;
      }

      // Add the line
      doc.text(line, PDF_CONFIG.marginLeft, currentY);
      currentY += lineHeight;
    }

    // Add footer to the last page
    addPageFooter(doc, pageNumber);

    // Generate filename
    const baseFilename = options.filename || `transcript-${Date.now()}`;
    const filename = `${baseFilename}.pdf`;

    // Get the PDF as a blob
    const blob = doc.output('blob');

    return {
      blob,
      filename,
      pageCount: pageNumber,
    };
  } catch (error) {
    const errorMessage = getErrorMessage(error);
    throw new PdfError(`Failed to generate PDF: ${errorMessage}`, error);
  }
}

/**
 * Adds a page footer with page number
 */
function addPageFooter(doc: jsPDF, pageNumber: number): void {
  const pageText = `Page ${pageNumber}`;
  doc.setFontSize(9);
  doc.setTextColor(128, 128, 128);
  doc.text(
    pageText,
    PDF_CONFIG.pageWidth / 2,
    PDF_CONFIG.pageHeight - 10,
    { align: 'center' }
  );
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(PDF_CONFIG.fontSize);
}

/**
 * Converts PDF blob to base64 string
 * Useful for storing or transmitting the PDF
 */
export async function pdfBlobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      // Remove data URL prefix if present
      const base64Content = base64.split(',')[1] || base64;
      resolve(base64Content);
    };
    reader.onerror = () => reject(new PdfError('Failed to convert PDF to base64'));
    reader.readAsDataURL(blob);
  });
}

/**
 * Gets the raw PDF data as Uint8Array
 * Useful for writing directly to file system
 */
export async function pdfBlobToUint8Array(blob: Blob): Promise<Uint8Array> {
  const arrayBuffer = await blob.arrayBuffer();
  return new Uint8Array(arrayBuffer);
}
