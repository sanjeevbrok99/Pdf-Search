declare module 'pdf.js-extract' {
  export interface PDFPage {
    content: string[];
    pageInfo: {
      num: number;
      scale: number;
      width: number;
      height: number;
    };
  }

  export interface PDFExtractResult {
    pages: PDFPage[];
    meta: {
      info: any;
      metadata: any[];
      numPages: number;
    };
  }

  export class PDFExtract {
    extractBuffer(buffer: Buffer): Promise<PDFExtractResult>;
  }
}
