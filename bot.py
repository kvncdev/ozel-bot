import discord
from discord.ext import tasks

# Sunucu üyelerini çekebilmek için gerekli izinler (Intents)
intents = discord.Intents.default()
intents.members = True
intents.guilds = True

client = discord.Client(intents=intents)

# -------- AYARLAR --------
TOKEN = 'BURAYA_BOT_TOKENINI_YAZIN'
GUILD_ID = 123456789012345678 # Sunucunun ID'si (Sunucu ismine sağ tıklayıp ID'yi Kopyala)
CHANNEL_ID = 123456789012345678 # İsmi değişecek ses kanalının ID'si
# -------------------------

@client.event
async def on_ready():
    print(f'{client.user} olarak giriş yapıldı!')
    update_member_count.start()

# Discord'un oran sınırlarına (rate limits) takılmamak için 10 dakikada bir güncelliyoruz
# Geçici bir çözüm olduğu için süreyi isterseniz 5 dakikaya da düşürebilirsiniz.
@tasks.loop(minutes=10)
async def update_member_count():
    try:
        guild = client.get_guild(GUILD_ID)
        if guild is None:
            print("HATA: Sunucu bulunamadı! GUILD_ID'yi kontrol edin.")
            return

        channel = guild.get_channel(CHANNEL_ID)
        if channel is None:
            print("HATA: Kanal bulunamadı! CHANNEL_ID'yi kontrol edin.")
            return

        # Toplam üye sayısı (Botlar dahil)
        member_count = guild.member_count
        new_name = f"👥 Aktif Üye: {member_count}"
        
        # Sadece sayı değiştiğinde API'ye istek at
        if channel.name != new_name:
            await channel.edit(name=new_name)
            print(f"Başarılı! Kanal adı güncellendi: {new_name}")
            
    except Exception as e:
        print(f"Bir hata oluştu: {e}")

client.run(TOKEN)
