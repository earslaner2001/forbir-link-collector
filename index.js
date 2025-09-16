const { fetchTwitterRSS } = require('./twitter-rss');
setInterval(fetchTwitterRSS, 60 * 1000);
const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
require('dotenv').config();
const db = require('./server'); // siteyle aynı DB

const client = new Client({
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

// Slash komutları kaydet
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

client.once('ready', () => {
    console.log(`🤖 Giriş yapıldı: ${client.user.tag}`);
});

client.on('messageCreate', message => {
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
        });
    }
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'sifirla') {
        db.prepare(`DELETE FROM links`).run();
        await interaction.reply('🗑️ Tüm linkler sıfırlandı!');
    }
});

const axios = require("axios");

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
            } catch (err) {
                console.error("❌ Gönderim hatası:", err.message);
            }
        }
    }
});


client.login(process.env.TOKEN);