const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const Parser = require('rss-parser'); 

const app = express();
app.get('/', (req, res) => res.send('Bot başarıyla çalışıyor ve 7/24 uyanık!'));
app.listen(process.env.PORT || 3000, () => console.log('Web sunucusu başlatıldı.'));

// --- BOT AYARLARI ---
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const TOTAL_CHANNEL_ID = process.env.TOTAL_CHANNEL_ID;
const ACTIVE_CHANNEL_ID = process.env.ACTIVE_CHANNEL_ID;
const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID || '1339630784738234442';

// Intent'lere Mesaj okuma izni eklendi (!test komutu için)
const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent 
    ]
});

const parser = new Parser();
let lastNewsDate = Date.now(); 

client.once('ready', async () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);

    client.user.setActivity('A part of kivy.gg', { type: ActivityType.Custom });

    updateChannelNames();
    setInterval(updateChannelNames, 10 * 60 * 1000); 
    setInterval(checkCryptoNews, 5 * 60 * 1000);

    // Bota kanal izni verilmişse açılışta test mesajı atsın
    try {
        const newsChannel = await client.channels.fetch(NEWS_CHANNEL_ID).catch(() => null);
        if (newsChannel) {
            await newsChannel.send('🚀 bitcoin uçtu!! (Sistem Testi)');
        }
    } catch (e) {
        console.error("Test mesajı atılamadı:", e);
    }
});

// !test Komutu
client.on('messageCreate', async message => {
    if (message.author.bot) return;

    if (message.content === '!test') {
        try {
            await message.reply("Haberler kontrol ediliyor, lütfen bekle...");
            const feed = await parser.parseURL('https://cointelegraph.com/rss');
            
            if (feed && feed.items.length > 0) {
                const item = feed.items[0]; // En yeni haber her zaman 0. sıradadır
                await message.channel.send(`Yeni gelişme: ${item.link}`);
            } else {
                await message.channel.send("❌ Haber bulunamadı veya bağlantı kurulamadı.");
            }
        } catch (error) {
            console.error('Test komutunda hata:', error.message);
            await message.channel.send("❌ Hata oluştu: " + error.message);
        }
    }
});

async function checkCryptoNews() {
    try {
        const channel = await client.channels.fetch(NEWS_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        const feed = await parser.parseURL('https://cointelegraph.com/rss');
        const items = feed.items.reverse();

        for (const item of items) {
            const itemDate = new Date(item.pubDate).getTime();
            if (itemDate > lastNewsDate) {
                lastNewsDate = itemDate; 
                await channel.send(`Yeni gelişme: ${item.link}`);
            }
        }
    } catch (error) {
        console.error('Haber çekilirken hata oluştu:', error.message);
    }
}

async function updateChannelNames() {
    if (!GUILD_ID || !TOTAL_CHANNEL_ID || !ACTIVE_CHANNEL_ID) return;

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) return;

        await guild.members.fetch({ withPresences: true });

        const totalChannel = await guild.channels.fetch(TOTAL_CHANNEL_ID).catch(() => null);
        if (totalChannel) {
            const totalCount = guild.memberCount;
            const newTotalName = `📊 Toplam Üye: ${totalCount}`;
            if (totalChannel.name !== newTotalName) {
                await totalChannel.edit({ name: newTotalName }).catch(console.error);
            }
        }

        const activeChannel = await guild.channels.fetch(ACTIVE_CHANNEL_ID).catch(() => null);
        if (activeChannel) {
            const activeCount = guild.members.cache.filter(member => 
                !member.user.bot && 
                member.presence && 
                ['online', 'idle', 'dnd'].includes(member.presence.status)
            ).size;
            
            const newActiveName = `🟢 Aktif Üye: ${activeCount}`;
            if (activeChannel.name !== newActiveName) {
                await activeChannel.edit({ name: newActiveName }).catch(console.error);
            }
        }
    } catch (error) {
        console.error('Kanal güncellenirken bir hata:', error);
    }
}

client.login(TOKEN);
