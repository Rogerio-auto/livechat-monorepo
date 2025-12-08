import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://ghbiigjdvzeoouxaviyz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdoYmlpZ2pkdnplb291eGF2aXl6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTcyODU5NzQxNSwiZXhwIjoyMDQ0MTczNDE1fQ.LJQGikfmA06u6FoSjlMbQMBGLqkDG1k4MOfHZATHo0M'
);

async function checkProposal() {
  const { data, error } = await supabase
    .from('proposals')
    .select(`
      number, 
      total_value,
      solar_monthly_production,
      solar_area_needed,
      solar_current_bill_value,
      solar_future_bill_value,
      financing_bank,
      financing_installments,
      financing_installment_value
    `)
    .eq('number', '202512-0008')
    .single();

  if (error) {
    console.error('❌ Erro:', error);
    return;
  }

  console.log('📋 Dados da proposta 202512-0008:');
  console.log('');
  console.log('💰 Financeiro:');
  console.log('  total_value:', data.total_value);
  console.log('  solar_current_bill_value:', data.solar_current_bill_value);
  console.log('  solar_future_bill_value:', data.solar_future_bill_value);
  console.log('');
  console.log('⚡ Técnico:');
  console.log('  solar_monthly_production:', data.solar_monthly_production);
  console.log('  solar_area_needed:', data.solar_area_needed);
  console.log('');
  console.log('💳 Financiamento:');
  console.log('  financing_bank:', data.financing_bank);
  console.log('  financing_installments:', data.financing_installments);
  console.log('  financing_installment_value:', data.financing_installment_value);
}

checkProposal();
