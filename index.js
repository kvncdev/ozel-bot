const { Client, GatewayIntentBits, ActivityType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const express = require('express');
const Parser = require('rss-parser'); 
const translate = require('translate-google'); 

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

app.get('/', (req, res) => res.send('Bot başarıyla çalışıyor ve 7/24 uyanık!'));

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
        const avatarURL = `https://www.google.com/s2/favicons?domain=${domainName}&sz=128`;

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

        const siteLogoUrl = `https://www.google.com/s2/favicons?domain=${domainName}&sz=128`;

        const embed = new EmbedBuilder()
            .setAuthor({ name: domainName, iconURL: siteLogoUrl })
            .setTitle(titleText)
            .setURL(itemLink)
            .setColor(embedColor)
            .setFooter({ text: 'kivy', iconURL: client.user.displayAvatarURL() })
            .setTimestamp(pubDate ? new Date(pubDate) : new Date());

        if (imageUrl) {
            const proxyUrl = `https://wsrv.nl/?url=${encodeURIComponent(imageUrl)}&w=800&h=450&fit=cover`;
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

    if (message.content.startsWith('k!sil')) {
        if (!message.member.permissions.has('ManageMessages')) {
            return message.reply("Bu komutu kullanmak için 'Mesajları Yönet' yetkisine sahip olmalısın!");
        }

        const args = message.content.split(' ');
        const amount = parseInt(args[1]);

        if (isNaN(amount) || amount < 1 || amount > 100) {
            return message.reply("Lütfen silmek için 1 ile 100 arasında bir sayı belirtin (Örn: `k!sil 50`).");
        }

        const row = new ActionRowBuilder()
            .addComponents(
                new ButtonBuilder()
                    .setCustomId('confirm_delete')
                    .setLabel('Evet, Sil')
                    .setStyle(ButtonStyle.Danger),
                new ButtonBuilder()
                    .setCustomId('cancel_delete')
                    .setLabel('İptal')
                    .setStyle(ButtonStyle.Secondary)
            );

        const confirmMsg = await message.reply({ 
            content: `⚠️ **${amount}** adet mesajı silmek istediğinizden emin misiniz?`, 
            components: [row] 
        });

        const filter = i => {
            if (i.user.id !== message.author.id) {
                i.reply({ content: "Bu butonları sadece komutu yazan kişi kullanabilir!", ephemeral: true });
                return false;
            }
            return true;
        };

        const collector = confirmMsg.createMessageComponentCollector({ filter, time: 15000, max: 1 });

        collector.on('collect', async i => {
            if (i.customId === 'confirm_delete') {
                await i.deferUpdate().catch(() => null);
                await confirmMsg.delete().catch(() => null);
                await message.delete().catch(() => null);

                try {
                    const deleted = await message.channel.bulkDelete(amount, true);
                    const successMsg = await message.channel.send(`✅ **${deleted.size}** mesaj başarıyla silindi!`);
                    setTimeout(() => successMsg.delete().catch(() => null), 5000);
                } catch (e) {
                    const errorMsg = await message.channel.send("❌ Mesajlar silinirken hata oluştu (Discord kuralları gereği 14 günden eski mesajlar toplu silinemez).");
                    setTimeout(() => errorMsg.delete().catch(() => null), 5000);
                }
            } else if (i.customId === 'cancel_delete') {
                await i.deferUpdate().catch(() => null);
                await confirmMsg.delete().catch(() => null);
                const cancelMsg = await message.channel.send("❌ İşlem iptal edildi.");
                setTimeout(() => cancelMsg.delete().catch(() => null), 5000);
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                confirmMsg.delete().catch(() => null);
                message.channel.send("⏳ 15 saniye içinde cevap verilmediği için işlem iptal edildi.").then(m => {
                    setTimeout(() => m.delete().catch(() => null), 5000);
                });
            }
        });
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
