const { Client, GatewayIntentBits } = require('discord.js');
const express = require('express');

// --- 7/24 AÇIK TUTMAK İÇİN WEB SUNUCUSU (Glitch vs. için) ---
const app = express();
app.get('/', (req, res) => res.send('Bot başarıyla çalışıyor ve 7/24 uyanık!'));
app.listen(process.env.PORT || 3000, () => console.log('Web sunucusu başlatıldı.'));
// -----------------------------------------------------------

// --- BOT AYARLARI ---
const TOKEN = process.env.TOKEN || 'BURAYA_BOT_TOKENINI_YAZIN';
const GUILD_ID = process.env.GUILD_ID || '1339630783887052850';
const TOTAL_CHANNEL_ID = process.env.TOTAL_CHANNEL_ID || '1527795201081606144';
const ACTIVE_CHANNEL_ID = process.env.ACTIVE_CHANNEL_ID || '1527795133632872652';
// --------------------

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences // Aktif/Çevrimiçi üyeleri görmek için ŞART!
    ]
});

client.once('ready', () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);

    // İlk çalıştığında hemen güncellesin
    updateChannelNames();

    // Ardından her 10 dakikada bir güncellesin
    setInterval(updateChannelNames, 10 * 60 * 1000); 
});

async function updateChannelNames() {
    try {
        const guild = await client.guilds.fetch(GUILD_ID);
        if (!guild) {
            console.log('Sunucu bulunamadı!');
            return;
        }

        // Tüm üyeleri ve çevrimiçi/çevrimdışı durumlarını sunucudan çek (kesin doğru sayım için)
        await guild.members.fetch({ withPresences: true });

        // 1. TOPLAM ÜYE SAYISI GÜNCELLEME (Botlar da dahildir)
        const totalChannel = await guild.channels.fetch(TOTAL_CHANNEL_ID);
        if (totalChannel) {
            const totalCount = guild.memberCount;
            const newTotalName = `📊 Toplam Üye: ${totalCount}`;
            if (totalChannel.name !== newTotalName) {
                await totalChannel.edit({ name: newTotalName });
                console.log(`Kanal güncellendi: ${newTotalName}`);
            }
        }

        // 2. AKTİF ÜYE SAYISI GÜNCELLEME (Sadece gerçek kullanıcılar, botlar hariç)
        const activeChannel = await guild.channels.fetch(ACTIVE_CHANNEL_ID);
        if (activeChannel) {
            const activeCount = guild.members.cache.filter(member => 
                !member.user.bot && // Botları dahil etme
                member.presence &&  // Durumu olanları kontrol et
                ['online', 'idle', 'dnd'].includes(member.presence.status) // Çevrimiçi, Boşta veya Rahatsız Etmeyin olanları say
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
