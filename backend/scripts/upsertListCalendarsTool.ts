import { supabaseAdmin } from "../src/lib/supabase";

async function main() {
  const tool = {
    key: 'list_calendars',
    name: 'Listar Calendários',
    category: 'Calendar',
    description: 'Lista calendários disponíveis para a empresa (e opcionalmente por usuário). Use antes de agendar para escolher o calendar_id.',
    schema: {
      type: 'function',
      function: {
        name: 'list_calendars',
        description: 'Retorna os calendários disponíveis. Se owner_id for informado, filtra por esse usuário. Sempre filtrado pela empresa atual.',
        parameters: {
          type: 'object',
          properties: {
            owner_id: { type: 'string', description: 'Filtrar por usuário dono do calendário (opcional)' },
            is_default: { type: 'boolean', description: 'Se true, retorna apenas o calendário padrão (por usuário)' }
          }
        }
      }
    },
    handler_type: 'INTERNAL_DB',
    handler_config: {
      table: 'calendars',
      action: 'select',
      allowed_columns: { read: ['id','name','color','is_default','owner_id','company_id','created_at','updated_at'] },
      restricted_columns: ['company_id'],
      max_results: 50
    }
  } as any;

  const { data, error } = await supabaseAdmin
    .from('tools_catalog')
    .upsert(tool, { onConflict: 'key' })
    .select('key');

  if (error) {
    console.error('❌ Upsert error:', error);
    process.exit(1);
  }
  console.log('✅ Upserted:', data);
}

main();
