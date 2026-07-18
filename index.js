const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const Parser = require('rss-parser'); 
const translate = require('translate-google'); // Çeviri eklentisi

const app = express();
app.get('/', (req, res) => res.send('Bot başarıyla çalışıyor ve 7/24 uyanık!'));
app.listen(process.env.PORT || 3000, () => console.log('Web sunucusu başlatıldı.'));

// --- BOT AYARLARI ---
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const TOTAL_CHANNEL_ID = process.env.TOTAL_CHANNEL_ID;
const ACTIVE_CHANNEL_ID = process.env.ACTIVE_CHANNEL_ID;
const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID || '1339630784738234442';

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

// Kaynaklarımız
const newsSources = [
    'https://cointelegraph.com/rss',
    'https://babypips.com/feed.rss',
    'https://finance.yahoo.com/news/rss',
    'https://feeds.bbci.co.uk/turkce/rss.xml'
];

// Her kaynak için ayrı ayrı son haber tarihini tutalım ki haber atlamasın
let lastNewsDates = {};
newsSources.forEach(url => {
    lastNewsDates[url] = Date.now();
});

client.once('ready', async () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
    client.user.setActivity('A part of kivy.gg', { type: ActivityType.Custom });

    updateChannelNames();
    setInterval(updateChannelNames, 10 * 60 * 1000); 
    setInterval(checkAllNews, 5 * 60 * 1000); // 5 Dakikada bir tüm kaynakları tara

    try {
        const newsChannel = await client.channels.fetch(NEWS_CHANNEL_ID).catch(() => null);
        if (newsChannel) {
            await newsChannel.send('200 OK');
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
            await message.channel.send("200 OK (Test Başlatıldı: Tüm kaynaklar taranıyor...)");
            
            for (const feedUrl of newsSources) {
                const feed = await parser.parseURL(feedUrl).catch(()=>null);
                if (feed && feed.items.length > 0) {
                    const item = feed.items[0]; 
                    let translatedTitle = item.title;
                    
                    if (!feedUrl.includes('bbci.co.uk')) {
                        try {
                            translatedTitle = await translate(item.title, {to: 'tr'});
                        } catch (e) {}
                    }

                    const domainName = new URL(item.link).hostname.replace(/^www\./, '');
                    await message.channel.send(`🗞️ **${translatedTitle}** - ${domainName}\n${item.link}`);
                }
            }
        } catch (error) {
            console.error('Test komutunda hata:', error.message);
        }
    }
});

async function checkAllNews() {
    try {
        const channel = await client.channels.fetch(NEWS_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        for (const feedUrl of newsSources) {
            const feed = await parser.parseURL(feedUrl).catch(() => null);
            if (!feed) continue;
            
            const items = feed.items.reverse();

            for (const item of items) {
                const itemDate = new Date(item.pubDate).getTime();
                
                // O sitenin son çekilen haberinden daha yeniyse
                if (itemDate > lastNewsDates[feedUrl]) {
                    lastNewsDates[feedUrl] = itemDate; 
                    
                    let titleText = item.title;
                    
                    // Eğer haber BBC Türkçe'den değilse İngilizceden Türkçeye çevir
                    if (!feedUrl.includes('bbci.co.uk')) {
                        try {
                            titleText = await translate(item.title, {to: 'tr'});
                        } catch (e) {
                            console.error("Çeviri hatası:", e);
                        }
                    }

                    const domainName = new URL(item.link).hostname.replace(/^www\./, '');
                    await channel.send(`🗞️ **${titleText}** - ${domainName}\n${item.link}`);
                }
            }
        }
    } catch (error) {
        console.error('Haberler çekilirken hata oluştu:', error.message);
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
