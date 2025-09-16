// deploy-commands.js
require('dotenv').config();
const { REST, Routes, ApplicationCommandOptionType } = require('discord.js');

const commands = [
    {
        name: 'linkler',
        description: 'Son 10 linki gösterir',
    },
    {
        name: 'linkler-sifirla',
        description: 'Tüm linkleri sıfırlar (DB temizlenir)',
    },
];

const rest = new REST({ version: '10' }).setToken(process.env.TOKEN);

(async () => {
    try {
        console.log('🔄 Komutlar yükleniyor...');

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body: commands },
        );

        console.log('✅ Komutlar yüklendi!');
    } catch (error) {
        console.error(error);
    }
})();