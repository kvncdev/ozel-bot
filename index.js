const { Client, GatewayIntentBits, SlashCommandBuilder, PermissionsBitField, ChannelType } = require('discord.js');
const express = require('express');
const fs = require('fs');
const path = require('path');

// --- 7/24 AÇIK TUTMAK İÇİN WEB SUNUCUSU ---
const app = express();
app.get('/', (req, res) => res.send('Bot başarıyla çalışıyor ve slash komutları aktif!'));
app.listen(process.env.PORT || 3000, () => console.log('Web sunucusu başlatıldı.'));
// ------------------------------------------

const TOKEN = process.env.TOKEN;

// Yapılandırmayı (kanal ID'lerini) kaydedeceğimiz dosya
const configPath = path.join(__dirname, 'config.json');

// Dosyadan ayarları oku veya varsayılanları yükle
let config = { active: false, guildId: null, totalChannelId: null, activeChannelId: null };
if (fs.existsSync(configPath)) {
    try {
        config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    } catch (e) {
        console.error("Config dosyası okunamadı, yenisi oluşturulacak.");
    }
}

// Ayarları kaydetme fonksiyonu
function saveConfig() {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
}

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.GuildPresences
    ]
});

client.once('ready', async () => {
    console.log(`${client.user.tag} olarak giriş yapıldı!`);

    // --- SLASH KOMUTLARINI OLUŞTUR VE YÜKLE ---
    const commands = [
        new SlashCommandBuilder()
            .setName('uye-kanal-ac')
            .setDescription('Üye sayacı sistemini aktif eder.')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
        
        new SlashCommandBuilder()
            .setName('uye-kanal-kapat')
            .setDescription('Üye sayacı sistemini kapatır.')
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
        
        new SlashCommandBuilder()
            .setName('toplam-uye-kanal')
            .setDescription('Toplam üye sayısının gösterileceği ses kanalını belirler.')
            .addChannelOption(option => 
                option.setName('kanal')
                .setDescription('Seçilecek ses kanalı')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true))
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator),
            
        new SlashCommandBuilder()
            .setName('aktif-uye-kanal')
            .setDescription('Aktif üye sayısının gösterileceği ses kanalını belirler.')
            .addChannelOption(option => 
                option.setName('kanal')
                .setDescription('Seçilecek ses kanalı')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true))
            .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    ].map(cmd => cmd.toJSON());

    try {
        await client.application.commands.set(commands);
        console.log('Slash komutları başarıyla Discorda yüklendi!');
    } catch (error) {
        console.error('Komut yükleme hatası:', error);
    }

    updateChannelNames();
    setInterval(updateChannelNames, 10 * 60 * 1000); 
});

client.on('interactionCreate', async interaction => {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'uye-kanal-ac') {
        config.active = true;
        // Komutun kullanıldığı sunucunun ID'sini otomatik kaydet
        config.guildId = interaction.guildId; 
        saveConfig();
        await interaction.reply({ content: '✅ Üye sayacı sistemi **açıldı**. Sayılar en geç 10 dakika içinde kanallara yansır.', ephemeral: true });
        updateChannelNames();
    } 
    else if (interaction.commandName === 'uye-kanal-kapat') {
        config.active = false;
        saveConfig();
        await interaction.reply({ content: '🛑 Üye sayacı sistemi **kapatıldı**. Kanalları manuel olarak silebilirsiniz.', ephemeral: true });
    }
    else if (interaction.commandName === 'toplam-uye-kanal') {
        const channel = interaction.options.getChannel('kanal');
        config.totalChannelId = channel.id;
        saveConfig();
        await interaction.reply({ content: `✅ Toplam üye kanalı ${channel} olarak ayarlandı.`, ephemeral: true });
        if (config.active) updateChannelNames();
    }
    else if (interaction.commandName === 'aktif-uye-kanal') {
        const channel = interaction.options.getChannel('kanal');
        config.activeChannelId = channel.id;
        saveConfig();
        await interaction.reply({ content: `✅ Aktif üye kanalı ${channel} olarak ayarlandı.`, ephemeral: true });
        if (config.active) updateChannelNames();
    }
});

async function updateChannelNames() {
    if (!config.active) return;
    
    try {
        // Öncelik config'teki kayıtlı sunucu id'sinde, bulamazsa botun bulunduğu ilk sunucuyu çeker
        const guildId = config.guildId || client.guilds.cache.first()?.id;
        if (!guildId) return;

        const guild = await client.guilds.fetch(guildId);
        if (!guild) return;

        await guild.members.fetch({ withPresences: true });

        // TOPLAM ÜYE
        if (config.totalChannelId) {
            const totalChannel = await guild.channels.fetch(config.totalChannelId).catch(() => null);
            if (totalChannel) {
                const totalCount = guild.memberCount;
                const newTotalName = `📊 Toplam Üye: ${totalCount}`;
                if (totalChannel.name !== newTotalName) {
                    await totalChannel.edit({ name: newTotalName }).catch(console.error);
                }
            }
        }

        // AKTİF ÜYE
        if (config.activeChannelId) {
            const activeChannel = await guild.channels.fetch(config.activeChannelId).catch(() => null);
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
        }
    } catch (error) {
        console.error('Kanal güncellenirken bir hata oluştu:', error);
    }
}

client.login(TOKEN);
