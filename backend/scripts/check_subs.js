
import db from '../src/pg.js';

async function checkSubscriptions() {
  try {
    const subs = await db.any('SELECT * FROM public.subscriptions');
    console.log('Subscriptions:', JSON.stringify(subs, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkSubscriptions();
