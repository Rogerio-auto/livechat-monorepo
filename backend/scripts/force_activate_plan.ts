
import dotenv from 'dotenv';
dotenv.config();

const args = process.argv.slice(2);
const companyId = args[0];
const planId = args[1];

if (!companyId || !planId) {
  console.log('Usage: npx tsx scripts/force_activate_plan.ts <company_id> <plan_id>');
  process.exit(1);
}

async function run() {
  const { default: db } = await import('../src/pg');
  
  try {
    console.log(`Updating subscription for company ${companyId} to plan ${planId}...`);
    
    await db.none(
      `UPDATE public.subscriptions 
       SET status = 'active',
           plan_id = $1,
           updated_at = NOW()
       WHERE company_id = $2`,
      [planId, companyId]
    );
    
    console.log('✅ Subscription updated successfully!');
    
    // Verify
    const sub = await db.oneOrNone('SELECT * FROM public.subscriptions WHERE company_id = $1', [companyId]);
    console.log('Current State:', sub);
    
  } catch (error) {
    console.error('Error:', error);
  }
}

run();
