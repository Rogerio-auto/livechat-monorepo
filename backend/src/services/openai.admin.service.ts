// backend/src/services/openai.admin.service.ts

import OpenAI from "openai";

// Cliente administrativo (usa sua master key)
const openaiAdmin = new OpenAI({
  apiKey: process.env.OPENAI_ADMIN_API_KEY || process.env.OPENAI_API_KEY,
  organization: process.env.OPENAI_ORG_ID,
});

// ==================== TYPES ====================

export type CreateProjectResult = {
  projectId: string;
  apiKey: string;
  apiKeyId: string;
};

export type ProjectUsageData = {
  startDate: string;
  endDate: string;
  totalCost: number;
  totalTokens: number;
  breakdown: Array<{
    date: string;
    model: string;
    requests: number;
    tokens: number;
    cost: number;
  }>;
};

// ==================== PROJECT MANAGEMENT ====================

/**
 * Cria um projeto na OpenAI e gera uma API key
 * @param companyName Nome da empresa (será usado no nome do projeto)
 * @param options Opções adicionais (rate limits, budget)
 * @returns Dados do projeto e API key gerada
 */
export async function createOpenAIProject(
  companyName: string,
  options?:  {
    monthlyBudgetUSD?: number;
    rateLimit?: number;
  }
): Promise<CreateProjectResult> {
  try {
    console.log(`[OpenAI Admin] Creating project for:  ${companyName}`);

    // 1. Criar o projeto (Projects API - Beta)
    // NOTA: Esta API pode não estar disponível para todas as contas
    // Fallback:  retornar erro para criação manual
    
    const projectName = `livechat-${companyName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    
    // Verificar se a API de projetos está disponível
    if (!process.env.OPENAI_PROJECTS_API_ENABLED) {
      throw new Error(
        'OPENAI_PROJECTS_API_ENABLED not set.  Manual API key creation required.'
      );
    }

    // MOCK: A OpenAI Projects API ainda está em beta limitada
    // Por enquanto, vamos simular a criação
    const project = await createProjectViaAPI(projectName, options);
    
    // 2. Gerar API key para o projeto
    const apiKey = await createProjectAPIKey(project.id, companyName);

    console.log(`[OpenAI Admin] ✅ Project created:  ${project.id}`);

    return {
      projectId:  project.id,
      apiKey: apiKey.key,
      apiKeyId: apiKey.id,
    };
  } catch (error:  any) {
    console.error('[OpenAI Admin] ❌ Error creating project:', error);
    
    // Se a API de projetos não estiver disponível, retornar erro amigável
    if (error.message?.includes('not available') || error.status === 404) {
      throw new Error(
        'OpenAI Projects API not available. Please create API key manually and use manual integration flow.'
      );
    }
    
    throw new Error(`Failed to create OpenAI project: ${error.message}`);
  }
}

/**
 * Cria projeto via API da OpenAI (quando disponível)
 * FALLBACK: Se não disponível, instrui criação manual
 */
async function createProjectViaAPI(name: string, options?: any) {
  // IMPORTANTE: A Projects API está em beta privada
  // Se sua conta não tem acesso, este endpoint falhará
  
  try {
    // Endpoint ainda não documentado publicamente
    const response = await fetch('https://api.openai.com/v1/organization/projects', {
      method:  'POST',
      headers:  {
        'Authorization': `Bearer ${process.env.OPENAI_ADMIN_API_KEY}`,
        'OpenAI-Organization': process.env.OPENAI_ORG_ID || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        ... options,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error?.message || 'Failed to create project');
    }

    return await response.json();
  } catch (error) {
    console.warn('[OpenAI Admin] Projects API not available, falling back to manual mode');
    throw error;
  }
}

/**
 * Cria API key para um projeto
 */
async function createProjectAPIKey(projectId: string, name: string) {
  try {
    const response = await fetch(
      `https://api.openai.com/v1/organization/projects/${projectId}/api_keys`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_ADMIN_API_KEY}`,
          'OpenAI-Organization': process.env.OPENAI_ORG_ID || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name:  `${name} - Auto Generated`,
        }),
      }
    );

    if (!response.ok) {
      throw new Error('Failed to create API key');
    }

    return await response.json();
  } catch (error) {
    throw error;
  }
}

// ==================== USAGE TRACKING ====================

/**
 * Busca dados de uso de um projeto específico via OpenAI Usage API
 * Docs: https://platform.openai.com/docs/api-reference/usage
 */
export async function getProjectUsage(
  projectId: string,
  startDate: Date,
  endDate: Date
): Promise<ProjectUsageData> {
  try {
    const start = startDate.toISOString().split('T')[0];
    const end = endDate.toISOString().split('T')[0];

    const response = await fetch(
      `https://api.openai.com/v1/usage?` +
      `start_date=${start}&` +
      `end_date=${end}&` +
      `project_id=${projectId}`,
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_ADMIN_API_KEY}`,
          'OpenAI-Organization':  process.env.OPENAI_ORG_ID || '',
        },
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI Usage API error: ${response.statusText}`);
    }

    const data = await response.json();

    // Processar e formatar dados
    const breakdown = data.data || [];
    const totalCost = breakdown.reduce((sum: number, item: any) => 
      sum + (item.cost || 0), 0
    );
    const totalTokens = breakdown.reduce((sum: number, item: any) => 
      sum + (item.n_context_tokens_total || 0) + (item.n_generated_tokens_total || 0), 0
    );

    return {
      startDate: start,
      endDate: end,
      totalCost,
      totalTokens,
      breakdown:  breakdown.map((item: any) => ({
        date: item.aggregation_timestamp || item.date,
        model: item.snapshot_id || 'unknown',
        requests: item.n_requests || 0,
        tokens: (item.n_context_tokens_total || 0) + (item.n_generated_tokens_total || 0),
        cost: item.cost || 0,
      })),
    };
  } catch (error:  any) {
    console.error('[OpenAI Admin] Error fetching usage:', error);
    throw error;
  }
}

// ==================== KEY MANAGEMENT ====================

/**
 * Revoga uma API key de um projeto
 */
export async function revokeProjectAPIKey(
  projectId: string,
  apiKeyId: string
): Promise<void> {
  try {
    const response = await fetch(
      `https://api.openai.com/v1/organization/projects/${projectId}/api_keys/${apiKeyId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_ADMIN_API_KEY}`,
          'OpenAI-Organization':  process.env.OPENAI_ORG_ID || '',
        },
      }
    );

    if (!response.ok) {
      throw new Error('Failed to revoke API key');
    }

    console.log(`[OpenAI Admin] ✅ API key revoked:  ${apiKeyId}`);
  } catch (error:  any) {
    console.error('[OpenAI Admin] Error revoking key:', error);
    throw error;
  }
}

/**
 * Valida se uma API key está ativa e funcional
 */
export async function validateAPIKey(apiKey: string): Promise<boolean> {
  try {
    const client = new OpenAI({ apiKey });
    
    // Fazer uma chamada mínima para testar a key
    await client.models.list();
    
    return true;
  } catch (error) {
    console.error('[OpenAI Admin] Invalid API key:', error);
    return false;
  }
}

// ==================== HELPERS ====================

/**
 * Verifica se a Projects API está disponível para a conta
 */
export async function checkProjectsAPIAvailability(): Promise<boolean> {
  try {
    const response = await fetch(
      'https://api.openai.com/v1/organization/projects',
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_ADMIN_API_KEY}`,
          'OpenAI-Organization': process.env.OPENAI_ORG_ID || '',
        },
      }
    );

    return response.ok;
  } catch (error) {
    return false;
  }
}
