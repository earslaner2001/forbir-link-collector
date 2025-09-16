// test.js
const Database = require('better-sqlite3');
const db = new Database('links.db');

// Son 10 linki çek
const rows = db.prepare('SELECT * FROM links ORDER BY id DESC LIMIT 10').all();

console.log("📌 Son 10 link:");
rows.forEach(r => {
    console.log(`[${r.id}] ${r.url} | ${r.author} | ${r.channel} | ${r.date}`);
});