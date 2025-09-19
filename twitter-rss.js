const Parser = require('rss-parser');
const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'links.db'));
const parser = new Parser();

// rss.app linkini buraya koy
const FEED_URL = "https://rss.app/feeds/UX89JZnVTZq3pDY7.xml";

async function fetchTwitterRSS(limit = 1) {
    try {
        const feed = await parser.parseURL(FEED_URL);

        // sadece limit kadar tweet al
        const items = feed.items.slice(0, limit);

        items.forEach(item => {
            const url = item.link;
            if (!url) return;

            const exists = db.prepare('SELECT 1 FROM links WHERE url = ?').get(url);
            if (exists) return;

            db.prepare(`
        INSERT INTO links (url, author, channel, date, source)
        VALUES (?, ?, 'twitter', ?, 'twitter')
      `).run(
                url,
                feed.title || "Twitter Kullanıcısı",
                new Date(item.isoDate || Date.now()).toISOString()
            );

            console.log(`🐦 Yeni tweet linki kaydedildi: ${url}`);
        });
    } catch (err) {
        console.error("RSS çekme hatası:", err.message);
    }
}

module.exports = { fetchTwitterRSS };