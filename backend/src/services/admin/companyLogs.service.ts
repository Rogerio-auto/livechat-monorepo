// backend/src/services/admin/companyLogs.service.ts
import db from "../../pg.js";

export interface CreateLogParams {
  company_id: string;
  user_id?: string;
  event_type: 'error' | 'warning' | 'info' | 'success';
  category: 'auth' | 'message' | 'agent' | 'system' | 'api' | 'database';
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  message?: string;
  metadata?: any;
  ip_address?: string;
  user_agent?: string;
}

export interface ListLogsParams {
  company_id: string;
  page?: number;
  limit?: number;
  type?: string;
  category?: string;
  severity?: string;
  startDate?: string;
  endDate?: string;
  userId?: string;
  search?: string;
}

export class CompanyLogsService {
  async create(params: CreateLogParams) {
    try {
      const sql = `
        INSERT INTO company_logs (
          company_id, user_id, event_type, category, severity, 
          title, message, metadata, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        RETURNING *
      `;
      const values = [
        params.company_id,
        params.user_id || null,
        params.event_type,
        params.category,
        params.severity,
        params.title,
        params.message || null,
        params.metadata ? JSON.stringify(params.metadata) : JSON.stringify({}),
        params.ip_address || null,
        params.user_agent || null
      ];

      const result = await db.query(sql, values);
      return result.rows[0];
    } catch (error) {
      console.error('[CompanyLogsService] Error creating log:', error);
      // Don't throw, we don't want to break the main app flow if logging fails
      return null;
    }
  }

  async list(params: ListLogsParams) {
    const { 
      company_id, page = 1, limit = 50, 
      type, category, severity, 
      startDate, endDate, userId, search 
    } = params;
    
    const offset = (page - 1) * limit;
    const values: any[] = [company_id];
    let counter = 2;
    
    let whereClauses = [`l.company_id = $1`];
    
    if (type) {
      whereClauses.push(`l.event_type = $${counter++}`);
      values.push(type);
    }
    
    if (category) {
      whereClauses.push(`l.category = $${counter++}`);
      values.push(category);
    }
    
    if (severity) {
      whereClauses.push(`l.severity = $${counter++}`);
      values.push(severity);
    }
    
    if (userId) {
      whereClauses.push(`l.user_id = $${counter++}`);
      values.push(userId);
    }
    
    if (startDate) {
      whereClauses.push(`l.created_at >= $${counter++}`);
      values.push(startDate);
    }
    
    if (endDate) {
      whereClauses.push(`l.created_at <= $${counter++}`);
      values.push(endDate);
    }
    
    if (search) {
      whereClauses.push(`(l.title ILIKE $${counter} OR l.message ILIKE $${counter})`);
      values.push(`%${search}%`);
      counter++;
    }
    
    const whereSql = whereClauses.join(' AND ');
    
    const countQuery = `SELECT COUNT(*) FROM company_logs l WHERE ${whereSql}`;
    const dataQuery = `
      SELECT l.*, u.name as user_name 
      FROM company_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE ${whereSql}
      ORDER BY l.created_at DESC
      LIMIT $${counter++} OFFSET $${counter++}
    `;
    
    const [countResult, dataResult] = await Promise.all([
      db.query(countQuery, values),
      db.query(dataQuery, [...values, limit, offset])
    ]);
    
    const total = parseInt(countResult.rows[0].count);
    
    // Stats for the last 24h
    const statsQuery = `
      SELECT 
        event_type, 
        COUNT(*) as count 
      FROM company_logs 
      WHERE company_id = $1 AND created_at > NOW() - INTERVAL '24 hours'
      GROUP BY event_type
    `;
    const statsResult = await db.query(statsQuery, [company_id]);
    
    const stats = {
      total: statsResult.rows.reduce((acc: number, row: any) => acc + parseInt(row.count || '0'), 0),
      errors: parseInt(statsResult.rows.find((r: any) => r.event_type === 'error')?.count || '0'),
      warnings: parseInt(statsResult.rows.find((r: any) => r.event_type === 'warning')?.count || '0'),
      info: parseInt(statsResult.rows.find((r: any) => r.event_type === 'info')?.count || '0'),
      success: parseInt(statsResult.rows.find((r: any) => r.event_type === 'success')?.count || '0'),
    };

    return {
      logs: dataResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      stats
    };
  }

  async getById(id: string, company_id: string) {
    const sql = `
      SELECT l.*, u.name as user_name, u.email as user_email
      FROM company_logs l
      LEFT JOIN users u ON l.user_id = u.id
      WHERE l.id = $1 AND l.company_id = $2
    `;
    const result = await db.query(sql, [id, company_id]);
    return result.rows[0];
  }
}

export const companyLogsService = new CompanyLogsService();
