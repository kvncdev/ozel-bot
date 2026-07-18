const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');
const Parser = require('rss-parser'); // Haber çekmek için eklenti

// --- 7/24 AÇIK TUTMAK İÇİN WEB SUNUCUSU (UptimeRobot vs. için) ---
const app = express();
app.get('/', (req, res) => res.send('Bot başarıyla çalışıyor ve 7/24 uyanık!'));
app.listen(process.env.PORT || 3000, () => console.log('Web sunucusu başlatıldı.'));
// -----------------------------------------------------------

// --- BOT AYARLARI (Render üzerinden çekilecek) ---
const TOKEN = process.env.TOKEN;
const GUILD_ID = process.env.GUILD_ID;
const TOTAL_CHANNEL_ID = process.env.TOTAL_CHANNEL_ID;
const ACTIVE_CHANNEL_ID = process.env.ACTIVE_CHANNEL_ID;
const NEWS_CHANNEL_ID = process.env.NEWS_CHANNEL_ID || '1339630784738234442'; // Haber kanalı
// --------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences 
    ]
});

const parser = new Parser();
let lastNewsDate = Date.now(); // Bot çalıştığı andan itibaren olan haberleri çeker (eski haberleri spamlamaz)

client.once('ready', async () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);

    // Botun "Oynuyor" / "Durum" kısmını ayarla
    client.user.setActivity('A part of kivy.gg', { type: ActivityType.Custom });

    // İlk çalıştığında kanalları güncellesin
    updateChannelNames();

    // Ardından her 10 dakikada bir kanalları güncellesin
    setInterval(updateChannelNames, 10 * 60 * 1000); 

    // Haberleri her 5 dakikada bir kontrol et
    setInterval(checkCryptoNews, 5 * 60 * 1000);
});

async function checkCryptoNews() {
    try {
        const channel = await client.channels.fetch(NEWS_CHANNEL_ID).catch(() => null);
        if (!channel) return;

        // Kripto haberlerinin ana merkezi olan Cointelegraph'tan çekiyoruz
        const feed = await parser.parseURL('https://cointelegraph.com/rss');
        
        // Haberleri eskiden yeniye doğru sırala (Önce eski haber düşsün)
        const items = feed.items.reverse();

        for (const item of items) {
            const itemDate = new Date(item.pubDate).getTime();
            
            // Eğer haber botun hafızasındaki son haber tarihinden yeniyse paylaş
            if (itemDate > lastNewsDate) {
                lastNewsDate = itemDate; // Son haber tarihini güncelle
                
                await channel.send(`📰 **${item.title}**\n${item.link}`);
            }
        }
    } catch (error) {
        console.error('Haber çekilirken hata oluştu:', error.message);
    }
}

async function updateChannelNames() {
    // Eksik ayar varsa işlemi durdur ve uyar
    if (!GUILD_ID || !TOTAL_CHANNEL_ID || !ACTIVE_CHANNEL_ID) {
        console.log("HATA: Render panelinden GUILD_ID, TOTAL_CHANNEL_ID veya ACTIVE_CHANNEL_ID ayarlanmamış!");
        return;
    }

    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) {
            console.log('Sunucu bulunamadı!');
            return;
        }

        // Tüm üyeleri ve çevrimiçi/çevrimdışı durumlarını sunucudan tazele
        await guild.members.fetch({ withPresences: true });

        // 1. TOPLAM ÜYE SAYISI GÜNCELLEME 
        const totalChannel = await guild.channels.fetch(TOTAL_CHANNEL_ID).catch(() => null);
        if (totalChannel) {
            const totalCount = guild.memberCount;
            const newTotalName = `📊 Toplam Üye: ${totalCount}`;
            if (totalChannel.name !== newTotalName) {
                await totalChannel.edit({ name: newTotalName }).catch(console.error);
                console.log(`Kanal güncellendi: ${newTotalName}`);
            }
        }

        // 2. AKTİF ÜYE SAYISI GÜNCELLEME 
        const activeChannel = await guild.channels.fetch(ACTIVE_CHANNEL_ID).catch(() => null);
        if (activeChannel) {
            const activeCount = guild.members.cache.filter(member => 
                !member.user.bot && 
                member.presence && 
                ['online', 'idle', 'dnd'].includes(member.presence.status)
            ).size;
            
            const newActiveName = `🟢 Aktif Üye: ${activeCount}`;
            if (activeChannel.name !== newActiveName) {
                await activeChannel.edit({ name: newActiveName });
                console.log(`Kanal güncellendi: ${newActiveName}`);
            }
        }
    } catch (error) {
        console.error('Kanal güncellenirken bir hata oluştu:', error);
    }
}

client.login(TOKEN);
