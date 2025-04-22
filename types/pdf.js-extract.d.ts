declare module 'pdf.js-extract' {
  export interface PDFExtractText {
    str: string;
    x: number;
    y: number;
    fontName: string;
  }

  export interface PDFExtractPage {
    pageInfo: {
      num: number;
      scale: number;
      rotation: number;
      offsetX: number;
      offsetY: number;
      width: number;
      height: number;
    };
    content: PDFExtractText[];
  }

  export interface PDFExtractResult {
    meta: {
      info: {
        PDFFormatVersion: string;
        IsAcroFormPresent: boolean;
        IsXFAPresent: boolean;
        [key: string]: any;
      };
      metadata: any;
      numPages: number;
    };
    pages: PDFExtractPage[];
  }

  export class PDFExtract {
    extractBuffer(buffer: Buffer, options?: { firstPage?: number; lastPage?: number }): Promise<PDFExtractResult>;
    extract(filename: string, options?: { firstPage?: number; lastPage?: number }): Promise<PDFExtractResult>;
  }
}