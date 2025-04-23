declare module 'pdf-parse/lib/pdf-parse.js' {
  import { Buffer } from 'buffer';

  interface PDFInfo {
    text: string;
    numpages: number;
    numrender: number;
    info: Record<string, any>;
    metadata: any;
    version: string;
  }

  function pdf(buffer: Buffer, options?: any): Promise<PDFInfo>;

  export default pdf;
}
