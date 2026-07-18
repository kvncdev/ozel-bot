const { Client, GatewayIntentBits, ActivityType, EmbedBuilder } = require('discord.js');
const express = require('express');
const Parser = require('rss-parser'); 
const translate = require('translate-google'); 
const Jimp = require('jimp'); 

// --- BOT AYARLARI ---
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const TOTAL_CHANNEL_ID = process.env.TOTAL_CHANNEL_ID;
const ACTIVE_CHANNEL_ID = process.env.ACTIVE_CHANNEL_ID;
const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID || '1339630784738234442';
const NOTIFICATION_ROLE_ID = process.env.NOTIFICATION_ROLE_ID || '1527985419168387112';
const APP_URL = process.env.APP_URL || 'https://uye-sayisi-botu.onrender.com';

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent 
    ]
});

// --- YARI YARIYA AVATAR SİSTEMİ (Express Web Sunucusu) ---
const app = express();
const avatarCache = {}; 

app.get('/', (req, res) => res.send('Bot başarıyla çalışıyor ve 7/24 uyanık!'));

app.get('/avatar/:domain', async (req, res) => {
    const domain = req.params.domain;
    
    // Daha önce oluşturduysak hafızadan ver (Sistemi yormamak için)
    if (avatarCache[domain]) {
        res.setHeader('Content-Type', 'image/png');
        return res.send(avatarCache[domain]);
    }

    try {
        const botAvatarUrl = client.user.displayAvatarURL({ extension: 'png', size: 128 });
        const siteLogoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;

        const botImg = await Jimp.read(botAvatarUrl);
        const siteImg = await Jimp.read(siteLogoUrl);

        botImg.resize(128, 128);
        siteImg.resize(128, 128);

        const outImg = new Jimp(128, 128);
        
        // Sol yarıya botun resmini koy
        botImg.crop(0, 0, 64, 128);
        outImg.composite(botImg, 0, 0);

        // Sağ yarıya sitenin logosunu koy
        siteImg.crop(64, 0, 64, 128);
        outImg.composite(siteImg, 64, 0);

        const buffer = await outImg.getBufferAsync(Jimp.MIME_PNG);
        avatarCache[domain] = buffer; // Hafızaya kaydet

        res.setHeader('Content-Type', 'image/png');
        res.send(buffer);
    } catch (e) {
        console.error("Avatar oluşturulamadı:", e.message);
        res.status(500).send('Error');
    }
});

app.get('/small-logo', async (req, res) => {
    const domain = req.query.domain;
    if (!domain) return res.status(400).send('No domain');

    try {
        const logoUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`;
        const logoImg = await Jimp.read(logoUrl);

        // Şeffaf, geniş bir tuval oluştur (Discord logoyu küçültsün diye etrafına boşluk ekliyoruz)
        const paddedImg = new Jimp(256, 256, 0x00000000); 
        paddedImg.composite(logoImg, 64, 64);

        const buffer = await paddedImg.getBufferAsync(Jimp.MIME_PNG);
        res.setHeader('Content-Type', 'image/png');
        res.send(buffer);
    } catch (e) {
        res.redirect(`https://www.google.com/s2/favicons?domain=${domain}&sz=128`);
    }
});

app.get('/news-image', async (req, res) => {
    const imageUrl = req.query.url;
    if (!imageUrl) return res.status(400).send('No URL');

    try {
        const img = await Jimp.read(imageUrl);
        img.cover(800, 450); // Tüm resimleri 800x450 ebatlarına zorla (cover)
        const buffer = await img.getBufferAsync(Jimp.MIME_PNG);
        
        res.setHeader('Content-Type', 'image/png');
        res.send(buffer);
    } catch (e) {
        console.error("Haber resmi işlenemedi:", e.message);
        res.redirect(imageUrl); // Hata olursa orijinal resmi geri gönder
    }
});

app.listen(process.env.PORT || 3000, () => console.log('Web sunucusu başlatıldı.'));


const parser = new Parser({
    customFields: {
        item: [
            ['media:content', 'mediaContent'],
            ['media:thumbnail', 'mediaThumbnail']
        ]
    }
});

const newsSources = [
    'https://cointelegraph.com/rss',
    'https://babypips.com/feed.rss',
    'https://finance.yahoo.com/news/rss',
    'https://feeds.bbci.co.uk/turkce/rss.xml'
];

let lastNewsDates = {};
newsSources.forEach(url => {
    lastNewsDates[url] = Date.now();
});

client.once('ready', async () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);
    client.user.setActivity('A part of kivy.gg', { type: ActivityType.Custom });

    updateChannelNames();
    setInterval(updateChannelNames, 10 * 60 * 1000); 
    setInterval(checkAllNews, 5 * 60 * 1000); 

    try {
        const newsChannel = await client.channels.fetch(NEWS_CHANNEL_ID).catch(() => null);
        if (newsChannel) {
            await newsChannel.send('200 OK');
        }
    } catch (e) {
        console.error("Test mesajı atılamadı:", e);
    }
});

const siteColors = {
    'cointelegraph.com': '#FABF2C',
    'babypips.com': '#1D70B8',
    'finance.yahoo.com': '#6001D2',
    'bbc.com': '#B80000',
    'bbc.co.uk': '#B80000'
};

// Webhook ile gönderim yapacak yardımcı fonksiyon
async function sendViaWebhook(channel, titleText, item, feedUrl) {
    try {
        const itemLink = item.link;
        const pubDate = item.pubDate;

        const webhooks = await channel.fetchWebhooks();
        let webhook = webhooks.find(wh => wh.token);

        if (!webhook) {
            webhook = await channel.createWebhook({
                name: 'Kivy News',
            });
        }

        const urlObj = new URL(itemLink);
        let domainName = urlObj.hostname.replace(/^www\./, '');
        
        let siteName = domainName.split('.')[0];
        siteName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
        
        let embedColor = siteColors[domainName] || '#2ECC71';

        if (feedUrl.includes('bbci')) {
            siteName = 'BBC Türkçe';
            embedColor = '#B80000';
        }

        // İsim "Kivy" olmadan direkt site adı olacak
        const username = siteName;
        // Avatar bizim dinamik oluşturduğumuz yarı yarıya resim olacak
        const avatarURL = `${APP_URL}/avatar/${domainName}`;

        let imageUrl = null;
        if (item.enclosure && item.enclosure.url) {
            imageUrl = item.enclosure.url;
        } else if (item.mediaContent && item.mediaContent.$ && item.mediaContent.$.url) {
            imageUrl = item.mediaContent.$.url;
        } else if (item.mediaThumbnail && item.mediaThumbnail.$ && item.mediaThumbnail.$.url) {
            imageUrl = item.mediaThumbnail.$.url;
        } else if (item.content) {
            const match = item.content.match(/<img[^>]+src="([^">]+)"/);
            if (match) imageUrl = match[1];
        }

        const siteLogoUrl = `${APP_URL}/small-logo?domain=${domainName}`;

        const embed = new EmbedBuilder()
            .setTitle(`**${domainName}**`)
            .setDescription(`[**${titleText}**](${itemLink})`)
            .setColor(embedColor)
            .setFooter({ text: 'kivy', iconURL: client.user.displayAvatarURL() })
            .setTimestamp(pubDate ? new Date(pubDate) : new Date())
            .setThumbnail(siteLogoUrl);

        if (imageUrl) {
            const proxyUrl = `${APP_URL}/news-image?url=${encodeURIComponent(imageUrl)}`;
            embed.setImage(proxyUrl);
        }

        await webhook.send({
            content: `<@&${NOTIFICATION_ROLE_ID}>`,
            username: username,
            avatarURL: avatarURL,
            embeds: [embed]
        });
    } catch (error) {
        console.error('Webhook hatası:', error.message);
        await channel.send(`🗞️ **${titleText}** - ${new URL(itemLink).hostname.replace(/^www\./, '')}\n${itemLink}`);
    }
}

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

                    await sendViaWebhook(message.channel, translatedTitle, item, feedUrl);
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
                
                if (itemDate > lastNewsDates[feedUrl]) {
                    lastNewsDates[feedUrl] = itemDate; 
                    
                    let titleText = item.title;
                    
                    if (!feedUrl.includes('bbci.co.uk')) {
                        try {
                            titleText = await translate(item.title, {to: 'tr'});
                        } catch (e) {
                            console.error("Çeviri hatası:", e);
                        }
                    }

                    await sendViaWebhook(channel, titleText, item, feedUrl);
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
