import { describe, it, expect, vi, beforeAll } from 'vitest';
import { generatePdf, PdfError, pdfBlobToBase64, pdfBlobToUint8Array } from '../../lib/pdf';

// Polyfill Blob.arrayBuffer for JSDOM environment
beforeAll(() => {
  if (!Blob.prototype.arrayBuffer) {
    Blob.prototype.arrayBuffer = function (): Promise<ArrayBuffer> {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as ArrayBuffer);
        reader.onerror = () => reject(reader.error);
        reader.readAsArrayBuffer(this);
      });
    };
  }
});

describe('PDF Generation Module', () => {
  describe('generatePdf', () => {
    it('should generate a valid PDF blob', async () => {
      const result = await generatePdf('Test content');
      expect(result.blob).toBeInstanceOf(Blob);
      expect(result.blob.type).toBe('application/pdf');
      expect(result.pageCount).toBeGreaterThan(0);
    });

    it('should throw PdfError for empty content', async () => {
      await expect(generatePdf('')).rejects.toThrow(PdfError);
      await expect(generatePdf('   ')).rejects.toThrow(PdfError);
    });

    it('should throw PdfError for null/undefined content', async () => {
      await expect(generatePdf(null as any)).rejects.toThrow(PdfError);
      await expect(generatePdf(undefined as any)).rejects.toThrow(PdfError);
    });

    it('should throw PdfError for non-string content', async () => {
      await expect(generatePdf(123 as any)).rejects.toThrow(PdfError);
    });

    it('should include title when provided', async () => {
      const result = await generatePdf('Content', { title: 'My Title' });
      expect(result.blob).toBeInstanceOf(Blob);
    });

    it('should use custom filename when provided', async () => {
      const result = await generatePdf('Content', { filename: 'custom-name' });
      expect(result.filename).toBe('custom-name.pdf');
    });

    it('should generate default filename with timestamp', async () => {
      const result = await generatePdf('Content');
      expect(result.filename).toMatch(/^transcript-\d+\.pdf$/);
    });

    it('should handle long content with pagination', async () => {
      const longContent = 'Test paragraph.\n\n'.repeat(100);
      const result = await generatePdf(longContent);
      expect(result.pageCount).toBeGreaterThan(1);
    });

    it('should handle German umlauts', async () => {
      const germanText = 'Über die Brücke führt ein Weg nach München';
      const result = await generatePdf(germanText);
      expect(result.blob).toBeInstanceOf(Blob);
    });
  });

  describe('pdfBlobToUint8Array', () => {
    it('should convert blob to Uint8Array', async () => {
      // Create a proper test blob with known content
      const testData = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // PDF magic bytes
      const testBlob = new Blob([testData], { type: 'application/pdf' });
      const array = await pdfBlobToUint8Array(testBlob);
      expect(array).toBeInstanceOf(Uint8Array);
      expect(array.length).toBe(4);
      expect(array[0]).toBe(0x25); // '%' character
    });

    it('should handle empty blob', async () => {
      const emptyBlob = new Blob([], { type: 'application/pdf' });
      const array = await pdfBlobToUint8Array(emptyBlob);
      expect(array).toBeInstanceOf(Uint8Array);
      expect(array.length).toBe(0);
    });
  });

  describe('pdfBlobToBase64', () => {
    it('should convert blob to base64 string', async () => {
      // Create a proper test blob with known content
      const testData = new Uint8Array([0x25, 0x50, 0x44, 0x46]); // PDF magic bytes
      const testBlob = new Blob([testData], { type: 'application/pdf' });
      const base64 = await pdfBlobToBase64(testBlob);
      expect(typeof base64).toBe('string');
      expect(base64.length).toBeGreaterThan(0);
    });
  });

  describe('PdfError', () => {
    it('should have correct name property', () => {
      const error = new PdfError('Test error');
      expect(error.name).toBe('PdfError');
    });

    it('should store cause', () => {
      const cause = new Error('Original');
      const error = new PdfError('Wrapper', cause);
      expect(error.cause).toBe(cause);
    });
  });
});
