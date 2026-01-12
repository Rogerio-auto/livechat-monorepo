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
    // Usamos um nome descritivo para facilitar a identificação no dashboard da OpenAI
    const projectName = `7SION - ${companyName}`;
    
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
  try {
    // Endpoint correto para criação de projetos (Organization API)
    const response = await fetch('https://api.openai.com/v1/organization/projects', {
      method:  'POST',
      headers:  {
        'Authorization': `Bearer ${process.env.OPENAI_ADMIN_API_KEY || process.env.OPENAI_API_KEY}`,
        'OpenAI-Organization': process.env.OPENAI_ORG_ID || '',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        name,
        ... options,
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      let errorDetail = 'Failed to create project';
      try {
        const errorJson = JSON.parse(text);
        errorDetail = errorJson.error?.message || errorDetail;
      } catch (e) {
        errorDetail = `${errorDetail} (Status ${response.status})`;
      }
      console.error('[OpenAI Admin] Project creation failed:', text);
      throw new Error(errorDetail);
    }

    return await response.json();
  } catch (error) {
    console.error('[OpenAI Admin] Error in createProjectViaAPI:', error);
    throw error;
  }
}

/**
 * Cria API key para um projeto via Service Account
 * O modelo novo da OpenAI recomenda usar Service Accounts para chaves de projeto
 */
async function createProjectAPIKey(projectId: string, name: string) {
  try {
    // Criar um Service Account no projeto - isso gera automaticamente uma API Key
    const response = await fetch(
      `https://api.openai.com/v1/organization/projects/${projectId}/service_accounts`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_ADMIN_API_KEY || process.env.OPENAI_API_KEY}`,
          'OpenAI-Organization': process.env.OPENAI_ORG_ID || '',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name:  `SA-${name.slice(0, 20)}`,
        }),
      }
    );

    if (!response.ok) {
      const text = await response.text();
      let errorDetail = 'Failed to create service account';
      try {
        const errorJson = JSON.parse(text);
        errorDetail = errorJson.error?.message || errorDetail;
      } catch (e) {
        errorDetail = `${errorDetail} (Status ${response.status})`;
      }
      console.error('[OpenAI Admin] Service Account creation failed:', text);
      throw new Error(errorDetail);
    }

    const data = await response.json();
    
    // O objeto retornado contém a api_key
    if (!data.api_key || !data.api_key.value) {
      throw new Error('Service account created but no API key returned');
    }

    return {
      id: data.api_key.id,
      key: data.api_key.value
    };
  } catch (error) {
    console.error('[OpenAI Admin] Error in createProjectAPIKey:', error);
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
    // Tentar deletar como chave de projeto ou chave de service account
    // No modelo de Service Account, a chave pode ser deletada via:
    // DELETE /v1/organization/projects/{project_id}/api_keys/{key_id}
    const response = await fetch(
      `https://api.openai.com/v1/organization/projects/${projectId}/api_keys/${apiKeyId}`,
      {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_ADMIN_API_KEY || process.env.OPENAI_API_KEY}`,
          'OpenAI-Organization':  process.env.OPENAI_ORG_ID || '',
        },
      }
    );

    if (!response.ok) {
      const text = await response.text();
      console.error('[OpenAI Admin] Error revoking key:', text);
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
