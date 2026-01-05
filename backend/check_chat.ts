
import 'dotenv/config';
import { db } from './src/pg.ts';

async function check() {
  const chatId = 'e397edff-3691-4bd5-8a8b-a9e45a8f2dd2';
  
  console.log('--- CHAT DETAILS ---');
  const chat = await db.oneOrNone('SELECT * FROM public.chats WHERE id = $1 OR remote_id = $1', [chatId]);
  console.log(chat);
  
  if (chat) {
    console.log('--- INBOX DETAILS ---');
    const inbox = await db.oneOrNone('SELECT * FROM public.inboxes WHERE id = $1', [chat.inbox_id]);
    console.log(inbox);
  }
}

check().catch(console.error);
