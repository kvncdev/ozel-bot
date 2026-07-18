const { Client, GatewayIntentBits, ActivityType } = require('discord.js');
const express = require('express');

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
// --------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences 
    ]
});

client.once('ready', async () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);

    // Botun "Oynuyor" / "Durum" kısmını ayarla
    client.user.setActivity('A part of kivy.gg', { type: ActivityType.Custom });

    // İlk çalıştığında hemen güncellesin
    updateChannelNames();

    // Ardından her 10 dakikada bir güncellesin
    setInterval(updateChannelNames, 10 * 60 * 1000); 
});

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
                await activeChannel.edit({ name: newActiveName }).catch(console.error);
                console.log(`Kanal güncellendi: ${newActiveName}`);
            }
        }
    } catch (error) {
        console.error('Kanal güncellenirken bir hata oluştu:', error);
    }
}

client.login(TOKEN);
