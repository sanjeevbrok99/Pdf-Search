declare module 'pdf-parse' {
  export interface PDFParseData {
    numpages: number;
    numrender: number;
    info: any;
    metadata: any;
    version: string;
    text: string;
  }

  export default function pdfParse(dataBuffer: Buffer, options?: any): Promise<PDFParseData>;
}
