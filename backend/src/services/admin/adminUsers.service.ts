// backend/src/services/admin/adminUsers.service.ts
import db from "../../pg.js";

export interface ListUsersParams {
  company_id: string;
  page?: number;
  limit?: number;
  role?: string;
  status?: string;
  search?: string;
}

export class AdminUsersService {
  async listByCompany(params: ListUsersParams) {
    const { 
      company_id, page = 1, limit = 20, 
      role, status, search 
    } = params;
    
    const offset = (page - 1) * limit;
    const values: any[] = [company_id];
    let counter = 2;
    
    let whereClauses = [`company_id = $1`];
    
    if (role) {
      whereClauses.push(`role = $${counter++}`);
      values.push(role);
    }
    
    if (status) {
      whereClauses.push(`status = $${counter++}`);
      values.push(status);
    }
    
    if (search) {
      whereClauses.push(`(name ILIKE $${counter} OR email ILIKE $${counter})`);
      values.push(`%${search}%`);
      counter++;
    }
    
    const whereSql = whereClauses.join(' AND ');
    
    const countQuery = `SELECT COUNT(*) FROM users WHERE ${whereSql}`;
    const dataQuery = `
      SELECT id, name, email, avatar, role, status, last_login_at, login_count, created_at
      FROM users
      WHERE ${whereSql}
      ORDER BY created_at DESC
      LIMIT $${counter++} OFFSET $${counter++}
    `;
    
    const [countResult, dataResult] = await Promise.all([
      db.query(countQuery, values),
      db.query(dataQuery, [...values, limit, offset])
    ]);
    
    const total = parseInt(countResult.rows[0].count);
    
    // Summary by role
    const statsQuery = `
      SELECT role, COUNT(*) as count 
      FROM users 
      WHERE company_id = $1 
      GROUP BY role
    `;
    const statsResult = await db.query(statsQuery, [company_id]);
    
    return {
      users: dataResult.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      stats: statsResult.rows
    };
  }

  async updateRole(userId: string, companyId: string, role: string) {
    const sql = `
      UPDATE users 
      SET role = $1 
      WHERE id = $2 AND company_id = $3
      RETURNING id, name, email, role
    `;
    const result = await db.query(sql, [role, userId, companyId]);
    return result.rows[0];
  }

  async updateStatus(userId: string, companyId: string, status: string) {
    const sql = `
      UPDATE users 
      SET status = $1 
      WHERE id = $2 AND company_id = $3
      RETURNING id, name, email, status
    `;
    const result = await db.query(sql, [status, userId, companyId]);
    return result.rows[0];
  }

  async removeUser(userId: string, companyId: string) {
    // We might want to remove them or just null their company_id depending on the app logic
    // For now, let's assume we remove them or set status to 'deleted'
    const sql = `
      UPDATE users 
      SET company_id = NULL, status = 'removed'
      WHERE id = $1 AND company_id = $2
      RETURNING id, name, email
    `;
    const result = await db.query(sql, [userId, companyId]);
    return result.rows[0];
  }

  async getUserActivity(userId: string, companyId: string, limit = 10) {
    const sql = `
      SELECT id, event_type, category, severity, title, created_at
      FROM company_logs
      WHERE user_id = $1 AND company_id = $2
      ORDER BY created_at DESC
      LIMIT $3
    `;
    const result = await db.query(sql, [userId, companyId, limit]);
    return result.rows;
  }
}

export const adminUsersService = new AdminUsersService();
