declare module "multer" {
  import type { RequestHandler } from "express";

  interface MulterOptions {
    storage?: any;
    limits?: {
      fileSize?: number;
      files?: number;
    };
    fileFilter?: any;
  }

  interface Multer {
    single(field: string): RequestHandler;
    array(field: string, maxCount?: number): RequestHandler;
    fields(fields: Array<{ name: string; maxCount?: number }>): RequestHandler;
    none(): RequestHandler;
  }

  interface MulterStatic {
    (options?: MulterOptions): Multer;
    memoryStorage(): any;
    diskStorage(options: any): any;
  }

  const multer: MulterStatic;
  export default multer;
}
