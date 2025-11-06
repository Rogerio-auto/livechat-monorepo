#!/usr/bin/env tsx
import 'dotenv/config';
import { listAgentTools } from '../src/repos/tools.repo.ts';

function normalizeParametersSchema(raw: any): any | undefined {
  try {
    if (raw && typeof raw === 'object') {
      if (raw.type === 'function' && raw.function && typeof raw.function === 'object') {
        const p = (raw.function as any).parameters;
        return p && typeof p === 'object' ? p : { type: 'object', properties: {} };
      }
      if (raw.parameters && typeof raw.parameters === 'object' && !raw.type) {
        return raw.parameters;
      }
      if ((raw as any).function && typeof (raw as any).function === 'object' && (raw as any).function.parameters) {
        return (raw as any).function.parameters;
      }
      if (raw.type === 'object' || raw.properties || raw.required) {
        return { type: 'object', additionalProperties: true, ...raw };
      }
    }
    return { type: 'object', additionalProperties: true };
  } catch {
    return { type: 'object', additionalProperties: true };
  }
}

async function main() {
  const AGENT_ID = process.env.TEST_AGENT_ID || '52c55a45-5ef1-45a1-8022-c3d980d6e8e1';
  const tools = await listAgentTools({ agent_id: AGENT_ID, is_enabled: true });
  const mapped = tools.map((at: any) => ({
    type: 'function',
    function: {
      name: at.tool.key,
      description: at.tool.description || at.tool.name || undefined,
      parameters: normalizeParametersSchema(at.tool.schema),
    }
  }));
  for (const t of mapped) {
    const p = t.function.parameters || {};
    const keys = p.properties ? Object.keys(p.properties) : [];
    console.log('[tool]', t.function.name, {
      type: p.type,
      hasProperties: !!p.properties,
      propertyKeys: keys.slice(0, 8),
      required: Array.isArray(p.required) ? p.required : undefined,
    });
  }
}

main().catch(err => { console.error(err); process.exit(1); });
