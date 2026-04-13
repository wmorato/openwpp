import sqlite3 from 'sqlite3';
import { open } from 'sqlite';

async function checkDb() {
  const db = await open({
    filename: './openwpp.sqlite',
    driver: sqlite3.Database
  });

  const lid = '41502352883779@lid';
  console.log(`Checking messages for chatId = ${lid}...`);
  const messagesById = await db.all('SELECT * FROM messages WHERE chatId = ?', [lid]);
  console.log(`Messages by chatId: ${messagesById.length}`);

  // Let's also check if they are stored under a different ID
  const first10 = await db.all('SELECT id, chatId, sender, body FROM messages WHERE body != "" LIMIT 10');
  console.log('Sample rows:');
  console.log(first10);
  
  // Find messages where body might match or any message
  const lidSender = await db.all('SELECT count(*) as total FROM messages WHERE sender = ?', [lid]);
  console.log(`Messages by sender: ${lidSender[0].total}`);

  // Also query by a pattern
  const lidPattern = await db.all('SELECT * FROM messages WHERE id LIKE ? OR chatId LIKE ? OR sender LIKE ? LIMIT 5', [`%${lid}%`, `%${lid}%`, `%${lid}%`]);
  console.log('Matches by pattern search:');
  console.log(lidPattern);
}

checkDb();
