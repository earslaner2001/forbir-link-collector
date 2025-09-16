const express = require('express');
const path = require('path');
const Database = require('better-sqlite3');
const axios = require('axios');
const cheerio = require('cheerio');

const app = express();
const db = new Database(path.join(__dirname, 'links.db'));

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

// Listeleme
app.get('/', (req, res) => {
    const rows = db.prepare('SELECT * FROM links ORDER BY id DESC LIMIT 100').all();
    res.render('index', { links: rows });
});

// Link ekleme (site formu)
app.post('/add', (req, res) => {
    const { url } = req.body;
    if (url && /^https?:\/\//i.test(url)) {
        db.prepare(`
            INSERT INTO links (url, author, channel, date, source)
            VALUES (?, 'Anonim Kullanıcı', 'web', ?, 'site')
        `).run(url, new Date().toISOString());
    }
    res.redirect('/');
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🌍 Site çalışıyor: http://localhost:${port}`);
});

const { fetchTwitterRSS } = require('./twitter-rss');

// Test butonu için endpoint
app.post('/test-twitter', async (req, res) => {
    await fetchTwitterRSS(1); // sadece 1 tweet
    res.redirect('/');
});

// Linkleri sıfırlama
app.post('/reset', (req, res) => {
    db.prepare(`DELETE FROM links`).run();
    res.redirect('/');
});

// Yardımcı: URL içinden tweet ID çıkar (full URL de girilse çalışır)
function extractTweetId(input) {
    const m = String(input).match(/(\d{15,25})/);
    return m ? m[1] : null;
}

// Nitter’dan bir tweetin yanıtlarını çek
async function fetchThreadReplies(tweetId) {
    const candidates = [
        `https://nitter.net/i/status/${tweetId}`,
        `https://nitter.net/status/${tweetId}`
    ];

    let html = null;
    for (const url of candidates) {
        try {
            const { data } = await axios.get(url, {
                timeout: 15000,
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
                    'Accept-Language': 'tr-TR,tr;q=0.9,en-US;q=0.8,en;q=0.7',
                },
                maxRedirects: 5
            });
            html = data;
            if (html && html.includes('tweet')) break;
        } catch (e) {
            // sıradaki adayı dene
        }
    }
    if (!html) throw new Error('Nitter’dan veri alınamadı.');

    const $ = cheerio.load(html);

    const mainTweetSel = $('.main-thread .tweet').first().length ? '.main-thread .tweet' : '.timeline .tweet';
    const $main = $(mainTweetSel).first();
    const main = $main.length ? {
        authorName: $main.find('.fullname').text().trim(),
        authorHandle: $main.find('.username').text().trim(),
        text: $main.find('.tweet-content').text().trim(),
        time: $main.find('a.tweet-date').attr('title') || $main.find('a.tweet-date').text().trim(),
        link: 'https://x.com' + ($main.find('a.tweet-date').attr('href') || '').replace(/^\/+/, ''),
    } : null;

    const replies = [];
    $('.timeline .tweet.reply, .replies .tweet, .thread .tweet.reply').each((_, el) => {
        const $t = $(el);
        const text = $t.find('.tweet-content').text().trim();
        const authorName = $t.find('.fullname').text().trim();
        const authorHandle = $t.find('.username').text().trim();
        const when = $t.find('a.tweet-date').attr('title') || $t.find('a.tweet-date').text().trim();
        const link = 'https://x.com' + ($t.find('a.tweet-date').attr('href') || '').replace(/^\/+/, '');
        if (text) {
            replies.push({ authorName, authorHandle, text, time: when, link });
        }
    });

    return { main, replies };
}

// JSON API: ID parametresi ile
app.get('/api/thread/:id', async (req, res) => {
    try {
        const id = extractTweetId(req.params.id);
        if (!id) return res.status(400).json({ error: 'Geçerli bir tweet ID gir.' });
        const data = await fetchThreadReplies(id);
        res.json({ id, ...data });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Thread alınamadı' });
    }
});

// JSON API: query parametresi ile ?q=
app.get('/api/thread', async (req, res) => {
    try {
        const raw = req.query.q;
        const id = extractTweetId(raw);
        if (!id) return res.status(400).json({ error: 'Geçerli bir tweet ID/URL gir.' });
        const data = await fetchThreadReplies(id);
        res.json({ id, ...data });
    } catch (e) {
        res.status(500).json({ error: e.message || 'Thread alınamadı' });
    }
});

// EJS sayfası: /thread/:id
app.get('/thread/:id', async (req, res) => {
    try {
        const id = extractTweetId(req.params.id);
        if (!id) return res.status(400).send('Geçerli bir tweet ID gir.');

        const data = await fetchThreadReplies(id);
        res.render('thread', { id, ...data }); // thread.ejs çağıracak
    } catch (e) {
        res.status(500).send('Thread alınamadı: ' + (e.message || 'Hata'));
    }
});

// RSS feed çekme
const Parser = require('rss-parser');
const parser = new Parser();

app.post('/fetch-rss', async (req, res) => {
    const { rssUrl } = req.body;
    if (!rssUrl) return res.redirect('/');

    try {
        const feed = await parser.parseURL(rssUrl);
        const tweets = feed.items.map(item => ({
            title: item.title,
            link: item.link,
            date: item.pubDate,
            content: item.contentSnippet
        }));

        res.render('rss-view', { rssUrl, tweets });
    } catch (err) {
        console.error('RSS çekme hatası:', err.message);
        res.send('RSS alınamadı: ' + err.message);
    }
});

const rateLimit = require("express-rate-limit");

// sadece /add için limit
const addLimiter = rateLimit({
    windowMs: 10 * 60 * 1000, // 10 dakika
    max: 1, // 1 hak
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        const links = db.prepare("SELECT * FROM links ORDER BY id DESC LIMIT 100").all();
        res.render("index", { links, error: "⚠️ 10 dakika içinde sadece 1 link ekleyebilirsin." });
    }
});

// anonim link ekleme
app.post("/add", addLimiter, (req, res) => {
    const { url } = req.body;
    if (url && /^https?:\/\//i.test(url)) {
        db.prepare(`
      INSERT INTO links (url, author, channel, date, source)
      VALUES (?, 'Anonim Kullanıcı', 'web', ?, 'site')
    `).run(url, new Date().toISOString());
    }

    const links = db.prepare("SELECT * FROM links ORDER BY id DESC LIMIT 100").all();
    res.render("index", { links });
});


module.exports = db; // bot da kullanacak
