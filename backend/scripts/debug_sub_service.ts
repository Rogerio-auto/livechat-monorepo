
import dotenv from 'dotenv';
dotenv.config();

async function debugSubscription() {
  const { default: db } = await import('../src/pg');
  const companyId = 'd56a5396-22df-486a-8fea-a82138e1f614'; // User's company ID

  try {
    console.log(`Fetching subscription for company: ${companyId}`);

    const row = await db.oneOrNone(
      `SELECT 
        s.*,
        row_to_json(p.*) as plan
      FROM public.subscriptions s
      INNER JOIN public.plans p ON p.id = s.plan_id
      WHERE s.company_id = $1
      LIMIT 1`,
      [companyId]
    );

    console.log('Raw DB Row:', JSON.stringify(row, null, 2));

    if (row) {
        const parsedPlan = typeof row.plan === "string" ? JSON.parse(row.plan) : row.plan;
        console.log('Parsed Plan:', parsedPlan);
        console.log('Plan Name:', parsedPlan?.name);
        console.log('Plan Display Name:', parsedPlan?.display_name);
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

debugSubscription();
