import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const normalizePhoneDigits = (value: any) => {
  if (value === undefined || value === null) return '';
  if (typeof value === 'number') return String(value).replace(/\D/g, '');
  if (typeof value === 'string') return value.replace(/\D/g, '');
  return '';
};

export async function processStartChatJob(payload: { leadId: string; inboxId: string }) {
  const { leadId, inboxId } = payload || ({} as any);
  if (!leadId || !inboxId) throw new Error('leadId e inboxId obrigatórios');

  // Load lead with company
  const { data: lead } = await supabaseAdmin
    .from('leads')
    .select('id, name, phone, email, company_id')
    .eq('id', leadId)
    .maybeSingle();
  if (!lead) throw new Error('Lead não encontrado');

  const phoneDigits = normalizePhoneDigits((lead as any).phone);
  if (!phoneDigits) throw new Error('Lead sem telefone');
  const companyId = (lead as any).company_id || null;
  if (!companyId) throw new Error('Lead sem company_id');

  // Try find existing customer by id, by lead_id or by phone
  let customerRecord: any = null;
  try {
    const { data } = await supabaseAdmin
      .from('customers')
      .select('id, phone, lead_id, company_id')
      .eq('id', leadId)
      .maybeSingle();
    if (data?.id) customerRecord = data;
  } catch {}
  if (!customerRecord) {
    try {
      const { data } = await supabaseAdmin
        .from('customers')
        .select('id, phone, lead_id, company_id')
        .eq('lead_id', leadId)
        .maybeSingle();
      if (data?.id) customerRecord = data;
    } catch {}
  }
  if (!customerRecord) {
    try {
      const { data } = await supabaseAdmin
        .from('customers')
        .select('id, phone, lead_id, company_id')
        .eq('phone', phoneDigits)
        .maybeSingle();
      if (data?.id) customerRecord = data;
    } catch {}
  }

  if (!customerRecord) {
    // Create new customer, satisfying NOT NULL phone and company_id
    const insert: any = {
      id: leadId,
      company_id: companyId,
      lead_id: leadId,
      name: (lead as any).name || 'Cliente',
      phone: phoneDigits,
      email: (lead as any).email || null,
    };
    const { data: created, error: createErr } = await supabaseAdmin
      .from('customers')
      .insert([insert])
      .select('id')
      .single();
    if (createErr) throw new Error(createErr.message);
    customerRecord = created;
  } else {
    // Sync fields if needed
    const updates: any = {};
    if (!customerRecord.phone || customerRecord.phone !== phoneDigits) updates.phone = phoneDigits;
    if (!customerRecord.lead_id) updates.lead_id = leadId;
    if (!customerRecord.company_id) updates.company_id = companyId;
    if (Object.keys(updates).length) {
      await supabaseAdmin.from('customers').update(updates).eq('id', customerRecord.id);
    }
  }

  const customerId = customerRecord.id as string;
  // Upsert chat by (inbox_id, customer_id)
  const { data: chat, error: chatErr } = await supabaseAdmin
    .from('chats')
    .upsert({ inbox_id: inboxId, customer_id: customerId, status: 'OPEN' }, { onConflict: 'inbox_id,customer_id' })
    .select('id')
    .single();
  if (chatErr) throw new Error(chatErr.message);
  return { chatId: (chat as any).id as string };
}

