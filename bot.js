const { fetchTwitterRSS } = require('./twitter-rss');
setInterval(fetchTwitterRSS, 60 * 1000);

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
require('dotenv').config();
const sqlite3 = require("sqlite3").verbose();
const db = new sqlite3.Database("./links.db"); // kendi DB bağlantısı
const axios = require("axios");

// === Discord Bot ===
const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Slash komutları
const commands = [
    { name: 'sifirla', description: 'Tüm linkleri sıfırlar' }
];
const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        await rest.put(Routes.applicationCommands(process.env.CLIENT_ID), { body: commands });
        console.log('✅ Slash komutları yüklendi.');
    } catch (err) { console.error(err); }
})();

// === Log Sistemi ===
const botLogs = [];
function addLog(msg) {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    botLogs.unshift(entry);
    if (botLogs.length > 20) botLogs.pop(); // sadece son 20 log
}

// Bot hazır
client.once('ready', () => {
    console.log(`🤖 Giriş yapıldı: ${client.user.tag}`);
    addLog("✅ Bot başlatıldı");

    // DB’den status oku
    db.get("SELECT value FROM settings WHERE key = 'status'", (err, row) => {
        if (!err && row) {
            client.user.setActivity(row.value, { type: 0 }); // Playing
            console.log("🎮 Status yüklendi:", row.value);
            addLog(`🎮 Status yüklendi: ${row.value}`);
        }
    });
});

// Slash komutları
client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'sifirla') {
        db.run(`DELETE FROM links`);
        await interaction.reply('🗑️ Tüm linkler sıfırlandı!');
        addLog("🗑️ Slash komutuyla tüm linkler sıfırlandı");
    }
});

// Linkleri dış API'ye gönderme
client.on("messageCreate", async (message) => {
    if (message.author.bot) return;

    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const urls = message.content.match(urlRegex);
    if (urls) {
        for (const url of urls) {
            try {
                await axios.post("https://links.forbir.tr/api/add-link", {
                    url,
                    author: message.author.tag,
                    channel: message.channel.name
                });
                console.log(`✅ Link gönderildi: ${url}`);
                addLog(`✅ Link gönderildi: ${url}`);
            } catch (err) {
                console.error("❌ Gönderim hatası:", err.message);
                addLog("❌ Gönderim hatası: " + err.message);
            }
        }
    }
});

module.exports = { client, botLogs, addLog };

// Bot giriş
client.login(process.env.TOKEN);