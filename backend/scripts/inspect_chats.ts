import 'dotenv/config';
import { db } from '../src/pg.ts';

async function inspectTables() {
  try {
    const chatsColumns = await db.any(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chats'
    `);
    console.log('--- chats columns ---');
    console.table(chatsColumns);

    const messagesColumns = await db.any(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'chat_messages'
    `);
    console.log('--- chat_messages columns ---');
    console.table(messagesColumns);

    process.exit(0);
  } catch (error) {
    console.error('Error inspecting tables:', error);
    process.exit(1);
  }
}

inspectTables();
