const express = require("express");
const session = require("express-session");
const bcrypt = require("bcrypt");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
require("dotenv").config();

// Discord
const { Client, GatewayIntentBits, REST, Routes } = require("discord.js");
const axios = require("axios");

// HTTP + Socket.io
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const db = new sqlite3.Database("./links.db");

// Middleware
app.use(express.urlencoded({ extended: true }));
app.use(session({
    secret: "supersecretkey",
    resave: false,
    saveUninitialized: false
}));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));

app.use((req, res, next) => {
    res.locals.user = req.session.user || null;
    next();
});

function isAuthenticated(req, res, next) {
    if (!req.session.user) return res.redirect("/login");
    next();
}
function isRole(role) {
    return (req, res, next) => {
        if (!req.session.user || req.session.user.role !== role) {
            return res.status(403).send("Yetkiniz yok");
        }
        next();
    };
}

// === Discord Bot ===
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const commands = [{ name: "sifirla", description: "Tüm linkleri sıfırlar" }];
const rest = new REST({ version: "10" }).setToken(process.env.TOKEN);

(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log("✅ Slash komutları yüklendi.");
    } catch (err) { console.error(err); }
})();

const botLogs = [];
function addLog(msg) {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    botLogs.unshift(entry);
    if (botLogs.length > 20) botLogs.pop();
}

client.once("ready", () => {
    console.log(`🤖 Giriş yapıldı: ${client.user.tag}`);
    addLog("✅ Bot başlatıldı");
});

client.on("messageCreate", message => {
    if (message.author.bot) return;
    if (message.channel.id !== process.env.CHANNEL_ID) return;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.content.match(urlRegex);
    if (urls) {
        urls.forEach(url => {
            db.prepare(`
                INSERT INTO links (url, author, channel, date, source)
                VALUES (?, ?, ?, ?, 'discord')
            `).run(url, message.author.tag, message.channel.name, new Date().toISOString());

            console.log(`💾 Link kaydedildi: ${url}`);
            addLog(`💾 Link kaydedildi: ${url}`);

            io.emit("newLink", {
                id: Date.now(),
                url,
                author: message.author.tag,
                channel: message.channel.name,
                date: new Date().toISOString(),
                source: "discord"
            });
        });
    }
});

client.on("interactionCreate", async interaction => {
    if (!interaction.isChatInputCommand()) return;
    if (interaction.commandName === "sifirla") {
        db.prepare("DELETE FROM links").run();
        await interaction.reply("🗑️ Tüm linkler sıfırlandı!");
        addLog("🗑️ Slash komutuyla tüm linkler sıfırlandı");
        io.emit("resetLinks");
    }
});

client.login(process.env.TOKEN);

// === ROUTES ===

// Ana sayfa
app.get("/", (req, res) => {
    db.all("SELECT * FROM links ORDER BY id DESC", (err, rows) => {
        if (err) return res.status(500).send("DB Hatası");
        res.render("index", { links: rows });
    });
});

// Login/Register/Logout
app.get("/login", (req, res) => res.render("login"));
app.post("/login", (req, res) => {
    const { username, password } = req.body;
    db.get("SELECT * FROM users WHERE username = ?", [username], async (err, user) => {
        if (err || !user) return res.send("Kullanıcı bulunamadı");
        const match = await bcrypt.compare(password, user.password).catch(() => false);
        if (user.password === password || match) {
            req.session.user = { id: user.id, username: user.username, role: user.role };
            return res.redirect("/");
        } else return res.send("Şifre hatalı");
    });
});

app.get("/register", (req, res) => res.render("register"));
app.post("/register", async (req, res) => {
    const { username, password } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    // herkes USER rolüyle kaydedilir
    db.run("INSERT INTO users (username, password, role) VALUES (?, ?, ?)",
        [username, hashed, "user"],
        err => err ? res.send("Kayıt hatası: " + err.message) : res.redirect("/login"));
});

app.get("/logout", (req, res) => req.session.destroy(() => res.redirect("/")));

// Admin Paneli
app.get("/admin", isAuthenticated, isRole("admin"), (req, res) => {
    db.all("SELECT id, username, role FROM users", (err, users) => {
        if (err) return res.send("DB Hatası");
        res.render("admin", { users });
    });
});

// === Cooldown tablosu ===
const userCooldowns = {};

// Link ekleme/silme
app.post("/add-link", isAuthenticated, (req, res) => {
    const role = req.session.user.role;
    const username = req.session.user.username;

    // Normal user için 20s cooldown
    if (role === "user") {
        const now = Date.now();
        const last = userCooldowns[username] || 0;
        if (now - last < 20 * 1000) {
            return res.send("⏳ Çok hızlısın! 20 saniye bekle.");
        }
        userCooldowns[username] = now;
    }

    if (!["admin", "streamer", "user"].includes(role)) {
        return res.status(403).send("Yetkiniz yok");
    }

    const { url } = req.body;
    db.run("INSERT INTO links (url, author, channel, date, source) VALUES (?, ?, ?, datetime('now'), 'web')",
        [url, username, "web"],
        function (err) {
            if (err) return res.send("Hata: " + err.message);

            io.emit("newLink", {
                id: this.lastID,
                url,
                author: username,
                channel: "web",
                date: new Date().toISOString(),
                source: "web"
            });

            res.redirect("/");
        });
});

app.post("/delete-link/:id", isAuthenticated, (req, res) => {
    if (!["admin", "moderator", "streamer"].includes(req.session.user.role)) return res.status(403).send("Yetkiniz yok");
    db.run("DELETE FROM links WHERE id = ?", [req.params.id], err => {
        if (err) return res.send("Hata: " + err.message);
        io.emit("deleteLink", req.params.id);
        res.redirect("/");
    });
});

// Anonim link ekleme
app.post("/add-link-anon", (req, res) => {
    const { url } = req.body;
    db.run("INSERT INTO links (url, author, channel, date, source) VALUES (?, ?, ?, datetime('now'), 'anon')",
        [url, "Anonim", "web"], function (err) {
            if (err) return res.send("Hata: " + err.message);
            const linkId = this.lastID;

            io.emit("newLink", {
                id: linkId,
                url,
                author: "Anonim",
                channel: "web",
                date: new Date().toISOString(),
                source: "anon"
            });

            setTimeout(() => {
                db.run("DELETE FROM links WHERE id = ?", [linkId]);
                io.emit("deleteLink", linkId);
            }, 5 * 60 * 1000);

            res.redirect("/");
        });
});

// === BOT PANEL ===
app.get("/bot-panel", isAuthenticated, (req, res) => {
    const stats = { guilds: client.guilds.cache.size, users: client.users.cache.size };
    res.render("bot-panel", { stats, logs: botLogs });
});

app.post("/bot-send", isAuthenticated, async (req, res) => {
    const { channelId, message } = req.body;
    try {
        const channel = await client.channels.fetch(channelId);
        if (!channel) return res.send("Kanal bulunamadı");
        await channel.send(message);
        addLog(`✉️ Panelden gönderildi #${channelId}: ${message}`);
        res.redirect("/bot-panel");
    } catch (err) {
        res.send("Bot mesaj hatası: " + err.message);
    }
});

// Test Twitter endpoint
app.post("/test-twitter", isAuthenticated, (req, res) => {
    const role = req.session.user.role;
    if (!["admin", "moderator", "streamer"].includes(role)) return res.status(403).send("Yetkiniz yok");
    db.run("INSERT INTO links (url, author, channel, date, source) VALUES (?, ?, ?, datetime('now'), 'twitter')",
        ["https://twitter.com/test", "system", "twitter-bot"],
        function (err) {
            if (err) return res.send("Hata: " + err.message);

            io.emit("newLink", {
                id: this.lastID,
                url: "https://twitter.com/test",
                author: "system",
                channel: "twitter-bot",
                date: new Date().toISOString(),
                source: "twitter"
            });

            res.redirect("/");
        });
});

// Reset
app.post("/reset", isAuthenticated, (req, res) => {
    if (!["admin", "moderator", "streamer"].includes(req.session.user.role)) return res.status(403).send("Yetkiniz yok");

    db.run("DELETE FROM links", err => {
        if (err) return res.send("Hata: " + err.message);

        io.emit("resetLinks");

        botLogs.length = 0;
        addLog("🗑️ Panelden tüm linkler ve loglar sıfırlandı");

        res.redirect("/");
    });
});

// Logları sıfırla (sadece admin)
app.post("/reset-logs", isAuthenticated, isRole("admin"), (req, res) => {
    botLogs.length = 0;
    addLog("🧹 Loglar sıfırlandı");
    res.redirect("/bot-panel");
});

// Status değiştir
app.post("/set-status", isAuthenticated, (req, res) => {
    if (!["admin"].includes(req.session.user.role)) {
        return res.status(403).send("Yetkiniz yok");
    }

    const { status } = req.body;
    db.run("INSERT OR REPLACE INTO settings (key, value) VALUES ('status', ?)", [status], (err) => {
        if (err) return res.send("Hata: " + err.message);

        try {
            client.user.setActivity(status, { type: 0 });
            addLog(`🎮 Durum değiştirildi: ${status}`);
        } catch (err) {
            console.error("Durum değiştirme hatası:", err);
        }

        res.redirect("/bot-panel");
    });
});

// User link ekleme (normal user)
app.post("/add-link", isAuthenticated, (req, res) => {
    if (req.session.user.role !== "user" && !["admin", "streamer"].includes(req.session.user.role)) {
        return res.status(403).send("Yetkiniz yok");
    }

    const { url } = req.body;
    const username = req.session.user.username;

    const now = Date.now();
    if (cooldowns[username] && now - cooldowns[username] < 20 * 1000) {
        const remaining = Math.ceil((20 * 1000 - (now - cooldowns[username])) / 1000);

        // 🚨 Rate limit log gönder
        io.emit("rateLimitLog", {
            user: username,
            time: new Date().toLocaleTimeString("tr-TR"),
            remaining
        });

        return res.render("index", { error: `20 saniyede bir link ekleyebilirsin. (${remaining}sn kaldı)` });
    }

    cooldowns[username] = now;

    db.run("INSERT INTO links (url, author, channel, date, source) VALUES (?, ?, ?, datetime('now'), 'web')",
        [url, username, "web"],
        err => err ? res.send("Hata: " + err.message) : res.redirect("/")
    );
});

server.listen(3000, () => console.log("🌐 Server & Bot API running on http://localhost:3000"));