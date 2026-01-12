/**
 * Campaign Recipient List Upload Parser
 * Supports TXT, CSV, and XLSX file formats
 */

import { normalizeMsisdn } from "../../utils/util.util.js";

export type ParsedRecipient = {
  phone: string;
  name?: string | null;
  lineNumber: number;
  isValid: boolean;
  error?: string;
};

export type ParseResult = {
  total: number;
  valid: ParsedRecipient[];
  invalid: ParsedRecipient[];
};

/**
 * Validates phone number format
 * Must have at least 10 digits after normalization
 */
function validatePhone(phone: string): { isValid: boolean; normalized: string; error?: string } {
  const normalized = normalizeMsisdn(phone);
  
  if (!normalized) {
    return { isValid: false, normalized: "", error: "Número vazio" };
  }
  
  if (normalized.length < 10) {
    return { isValid: false, normalized, error: `Muito curto (${normalized.length} dígitos)` };
  }
  
  if (normalized.length > 15) {
    return { isValid: false, normalized, error: `Muito longo (${normalized.length} dígitos)` };
  }
  
  return { isValid: true, normalized };
}

/**
 * Parse TXT file (one phone per line, optional name separated by comma/tab)
 * Format examples:
 *   5511999999999
 *   5511999999999,João Silva
 *   5511999999999	João Silva
 */
export function parseTXT(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  const valid: ParsedRecipient[] = [];
  const invalid: ParsedRecipient[] = [];
  
  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Try comma or tab separator
    const parts = trimmed.split(/[,\t]/).map(p => p.trim());
    const phoneRaw = parts[0];
    const name = parts[1] || null;
    
    const validation = validatePhone(phoneRaw);
    
    const recipient: ParsedRecipient = {
      phone: validation.normalized,
      name,
      lineNumber: idx + 1,
      isValid: validation.isValid,
      error: validation.error,
    };
    
    if (validation.isValid) {
      valid.push(recipient);
    } else {
      invalid.push(recipient);
    }
  });
  
  return {
    total: lines.length,
    valid,
    invalid,
  };
}

/**
 * Parse CSV file (comma-separated, first row can be header)
 * Expected columns: phone, name (optional)
 * Auto-detects if first row is header
 */
export function parseCSV(content: string): ParseResult {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  const valid: ParsedRecipient[] = [];
  const invalid: ParsedRecipient[] = [];
  
  if (lines.length === 0) {
    return { total: 0, valid: [], invalid: [] };
  }
  
  // Detect if first line is header (contains non-numeric text in first column)
  const firstLine = lines[0].split(',')[0].trim();
  const hasHeader = !/^\+?\d+$/.test(firstLine) && firstLine.toLowerCase().includes('phone');
  
  const startIdx = hasHeader ? 1 : 0;
  const dataLines = lines.slice(startIdx);
  
  dataLines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) return;
    
    // Simple CSV parsing (doesn't handle quoted commas)
    const parts = trimmed.split(',').map(p => p.trim().replace(/^["']|["']$/g, ''));
    const phoneRaw = parts[0];
    const name = parts[1] || null;
    
    const validation = validatePhone(phoneRaw);
    
    const recipient: ParsedRecipient = {
      phone: validation.normalized,
      name,
      lineNumber: startIdx + idx + 1,
      isValid: validation.isValid,
      error: validation.error,
    };
    
    if (validation.isValid) {
      valid.push(recipient);
    } else {
      invalid.push(recipient);
    }
  });
  
  return {
    total: dataLines.length,
    valid,
    invalid,
  };
}

/**
 * Parse XLSX file using xlsx library
 * Expected columns: phone, name (optional)
 * Reads first sheet only
 */
export async function parseXLSX(buffer: Buffer): Promise<ParseResult> {
  try {
    // Dynamically import xlsx only when needed (large library)
    const XLSX = await import('xlsx');
    
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    
    if (!firstSheetName) {
      throw new Error('Planilha vazia');
    }
    
    const worksheet = workbook.Sheets[firstSheetName];
    const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 }) as any[][];
    
    if (jsonData.length === 0) {
      return { total: 0, valid: [], invalid: [] };
    }
    
    // Detect if first row is header
    const firstRow = jsonData[0];
    const hasHeader = firstRow.length > 0 && 
                      typeof firstRow[0] === 'string' && 
                      firstRow[0].toLowerCase().includes('phone');
    
    const startIdx = hasHeader ? 1 : 0;
    const dataRows = jsonData.slice(startIdx);
    
    const valid: ParsedRecipient[] = [];
    const invalid: ParsedRecipient[] = [];
    
    dataRows.forEach((row, idx) => {
      if (!row || row.length === 0) return;
      
      const phoneRaw = String(row[0] || '').trim();
      const name = row[1] ? String(row[1]).trim() : null;
      
      if (!phoneRaw) return;
      
      const validation = validatePhone(phoneRaw);
      
      const recipient: ParsedRecipient = {
        phone: validation.normalized,
        name,
        lineNumber: startIdx + idx + 1,
        isValid: validation.isValid,
        error: validation.error,
      };
      
      if (validation.isValid) {
        valid.push(recipient);
      } else {
        invalid.push(recipient);
      }
    });
    
    return {
      total: dataRows.length,
      valid,
      invalid,
    };
  } catch (error: any) {
    throw new Error(`Erro ao processar XLSX: ${error.message}`);
  }
}

/**
 * Main parser that detects file type and delegates to appropriate parser
 */
export async function parseRecipientFile(
  buffer: Buffer,
  filename: string
): Promise<ParseResult> {
  const ext = filename.toLowerCase().split('.').pop();
  const content = buffer.toString('utf-8');
  
  switch (ext) {
    case 'txt':
      return parseTXT(content);
      
    case 'csv':
      return parseCSV(content);
      
    case 'xlsx':
    case 'xls':
      return parseXLSX(buffer);
      
    default:
      throw new Error(`Formato não suportado: ${ext}. Use TXT, CSV ou XLSX.`);
  }
}
