
import db from '../backend/src/pg.js';

async function checkSubscriptions() {
  try {
    const subs = await db.any('SELECT * FROM public.subscriptions');
    console.log('Subscriptions:', JSON.stringify(subs, null, 2));
  } catch (error) {
    console.error('Error:', error);
  }
}

checkSubscriptions();
