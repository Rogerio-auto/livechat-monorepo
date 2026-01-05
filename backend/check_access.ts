import 'dotenv/config';
import { db } from './src/pg.ts';

async function check() {
  const userId = '207aefa8-e1cf-45ac-a389-854c55605467';
  const chatId = 'e397edff-3691-4bd5-8a8b-a9e45a8f2dd2';

  console.log('--- USER ---');
  const user = await db.oneOrNone('SELECT id, user_id, company_id, role FROM public.users WHERE user_id = $1', [userId]);
  console.log(user);

  console.log('--- CHAT ---');
  const chat = await db.oneOrNone('SELECT id, inbox_id, company_id, kind, remote_id FROM public.chats WHERE id = $1', [chatId]);
  console.log(chat);

  if (chat && chat.inbox_id) {
    console.log('--- INBOX ---');
    const inbox = await db.oneOrNone('SELECT id, company_id FROM public.inboxes WHERE id = $1', [chat.inbox_id]);
    console.log(inbox);
  }

  console.log('--- ACCESS QUERY ---');
  const access = await db.oneOrNone(
    `SELECT c.id as chat_id 
     FROM public.chats c
     JOIN public.inboxes i ON i.id = c.inbox_id
     JOIN public.users u ON u.company_id = i.company_id
     WHERE c.id = $1 AND u.user_id = $2`,
    [chatId, userId]
  );
  console.log('Access result:', access);
}

check().catch(console.error);
