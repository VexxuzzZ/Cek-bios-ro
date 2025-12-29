const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');
const axios = require('axios');
const fs = require('fs');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');

// ==========================
// KONFIGURASI DASAR 
// GANTI DENGAN DATA ANDA
const ADMIN_ID = 8248734943; // Ganti dengan ID Telegram Anda
const OWNER = "8248734943"; // Ganti dengan ID Telegram Anda
const BOT_TOKEN = '8525102753:AAEUMWcS1K5oYJVM-sBhvfl6wLtU34HBjPU'; // Ganti dengan token bot Anda

// API Configuration
const API_KEY = 'adminnn'; // Ganti dengan API key Anda
const BASE_URL = 'https://team-lunzy-and-rezz.vercel.app/api';

// GitHub Configuration
const GITHUB_TOKEN = "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"; // Ganti dengan token GitHub Anda
const GITHUB_OWNER = "F12241";
const GITHUB_REPO = "team-lunzy-and-rezz";
const GITHUB_FILE = "dataimel.txt";
const GITHUB_BRANCH = "main";

// Inisialisasi bot
const bot = new Telegraf(BOT_TOKEN);

// State WhatsApp
let waClient = null;
let waConnectionStatus = false;
const userCooldowns = {};

// Data premium users
const premiumFile = './premium.json';
let premiumUsers = fs.existsSync(premiumFile) 
  ? JSON.parse(fs.readFileSync(premiumFile, 'utf-8'))
  : [];

// Inisialisasi Octokit
const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: GITHUB_TOKEN });

// ==========================
// HELPER FUNCTIONS
// ==========================

function savePremium() {
  fs.writeFileSync(premiumFile, JSON.stringify(premiumUsers, null, 2));
}

function isPremium(id) {
  return premiumUsers.includes(id.toString());
}

function isAdmin(id) {
  return id.toString() === ADMIN_ID.toString();
}

function isOwner(id) {
  return id.toString() === OWNER.toString();
}

function formatResult(data) {
  let out = '';
  if (data.success !== undefined)
    out += `${data.success ? '✅ Berhasil' : '❌ Gagal'}`;
  if (data.email) out += `\n• Email: ${data.email}`;
  if (data.subject) out += `\n• Subjek: ${data.subject}`;
  if (data.response) out += `\n• Respon: ${data.response}`;
  return out;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ==========================
// GITHUB FUNCTIONS
// ==========================

async function githubGetFile() {
  try {
    const { data } = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: GITHUB_FILE,
      ref: GITHUB_BRANCH
    });

    const content = Buffer.from(data.content, 'base64').toString('utf-8');
    return { content, sha: data.sha };
  } catch (error) {
    if (error.status === 404) {
      return { content: '', sha: null };
    }
    throw error;
  }
}

async function githubUpdateFile(content, sha) {
  return await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: GITHUB_FILE,
    message: 'Update via Telegram Bot',
    content: Buffer.from(content).toString('base64'),
    sha: sha || undefined,
    branch: GITHUB_BRANCH
  });
}

async function deleteEmailFromGithub(target) {
  try {
    const { content, sha } = await githubGetFile();
    
    if (!content.trim()) {
      return { success: false, message: "Tidak ada data email." };
    }

    const lines = content.split('\n').filter(line => line.trim() !== '');
    const originalLength = lines.length;
    const newLines = lines.filter(line => !line.includes(target.split(':')[0]));

    if (originalLength === newLines.length) {
      return { success: false, message: "Email tidak ditemukan." };
    }

    const newContent = newLines.join('\n');
    await githubUpdateFile(newContent, sha);

    return { success: true, message: "Email berhasil dihapus." };
  } catch (error) {
    console.error('Error deleting email:', error);
    return { success: false, message: error.message };
  }
}

// ==========================
// WHATSAPP FUNCTIONS
// ==========================

async function startWhatsAppClient() {
  console.log("🚀 Memulai koneksi WhatsApp...");

  try {
    const { state, saveCreds } = await useMultiFileAuthState('./session');
    const { version } = await fetchLatestWaWebVersion();

    waClient = makeWASocket({
      auth: state,
      logger: pino({ level: "silent" }),
      printQRInTerminal: true,
      version,
      browser: ["Ubuntu", "Chrome", "20.0.00"]
    });

    waClient.ev.on("creds.update", saveCreds);

    waClient.ev.on("connection.update", (update) => {
      const { connection, lastDisconnect } = update;

      if (connection === "close") {
        waConnectionStatus = false;
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        
        console.log("❌ WA Disconnected. Reason:", reason);

        if (reason !== DisconnectReason.loggedOut) {
          console.log("🔄 Reconnecting in 5 seconds...");
          setTimeout(startWhatsAppClient, 5000);
        } else {
          console.log("🛑 Logged out. Delete session folder to re-pair.");
          waClient = null;
        }
      }

      if (connection === "open") {
        waConnectionStatus = true;
        console.log("✅ WhatsApp connected!");
      }
    });

  } catch (error) {
    console.error("Failed to start WhatsApp client:", error);
  }
}

// ==========================
// CEK BIO FUNCTION
// ==========================

async function handleBioCheck(ctx, numbersToCheck) {
  if (!waConnectionStatus) {
    return ctx.reply("⚠️ WhatsApp belum terkoneksi. Silakan pairing terlebih dahulu.");
  }

  if (!numbersToCheck || numbersToCheck.length === 0) {
    return ctx.reply("❌ Tidak ada nomor yang diberikan.");
  }

  await ctx.reply(`🔍 Sedang memeriksa ${numbersToCheck.length} nomor...`);

  const results = {
    withBio: [],
    noBio: [],
    notRegistered: []
  };

  try {
    const jids = numbersToCheck.map(n => `${n.trim()}@s.whatsapp.net`);
    
    // Check if numbers are registered on WhatsApp
    const existenceResults = await waClient.onWhatsApp(...jids);
    
    for (const result of existenceResults) {
      const number = result.jid.split('@')[0];
      
      if (!result.exists) {
        results.notRegistered.push(number);
        continue;
      }

      try {
        const status = await waClient.fetchStatus(result.jid);
        
        if (status && status.status && status.status.trim()) {
          const bioText = typeof status.status === 'string' 
            ? status.status 
            : (status.status.text || status.status.status || '');
            
          if (bioText.trim()) {
            results.withBio.push({
              number,
              bio: bioText,
              setAt: status.setAt ? new Date(status.setAt).toLocaleString('id-ID') : 'Tidak diketahui'
            });
          } else {
            results.noBio.push(number);
          }
        } else {
          results.noBio.push(number);
        }
      } catch (error) {
        results.noBio.push(number);
      }
      
      await sleep(500); // Delay untuk menghindari rate limit
    }

    // Generate report
    let report = `📊 HASIL CEK BIO\n\n`;
    report += `Total dicek: ${numbersToCheck.length}\n`;
    report += `Dengan Bio: ${results.withBio.length}\n`;
    report += `Tanpa Bio: ${results.noBio.length}\n`;
    report += `Tidak Terdaftar: ${results.notRegistered.length}\n\n`;

    if (results.withBio.length > 0) {
      report += "📱 NOMOR DENGAN BIO:\n";
      results.withBio.forEach((item, index) => {
        report += `${index + 1}. ${item.number}\n`;
        report += `   Bio: ${item.bio}\n`;
        report += `   Update: ${item.setAt}\n\n`;
      });
    }

    if (results.noBio.length > 0) {
      report += "\n📭 NOMOR TANPA BIO:\n";
      results.noBio.forEach((num, index) => {
        report += `${index + 1}. ${num}\n`;
      });
    }

    if (results.notRegistered.length > 0) {
      report += "\n❌ NOMOR TIDAK TERDAFTAR:\n";
      results.notRegistered.forEach((num, index) => {
        report += `${index + 1}. ${num}\n`;
      });
    }

    // Send as text if short, else as file
    if (report.length < 4000) {
      await ctx.reply(report);
    } else {
      const filename = `hasil_bio_${Date.now()}.txt`;
      fs.writeFileSync(filename, report);
      await ctx.replyWithDocument({ source: filename }, { caption: '📄 Hasil cek bio' });
      fs.unlinkSync(filename);
    }

  } catch (error) {
    console.error('Error checking bio:', error);
    await ctx.reply('❌ Terjadi kesalahan saat memeriksa bio.');
  }
}

// ==========================
// API CALL FUNCTION
// ==========================

async function callApi(endpoint, params = {}) {
  try {
    const url = new URL(BASE_URL + endpoint);
    params.apikey = API_KEY;
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });

    const response = await fetch(url.toString());
    return await response.json();
  } catch (error) {
    console.error('API Error:', error);
    return { success: false, error: error.message };
  }
}

// ==========================
// COMMAND HANDLERS
// ==========================

// START COMMAND
bot.start(async (ctx) => {
  const welcomeText = `
╔═══════════════════════╗
║    🤖 FIX MERAH BOT   ║
║       BIO CHECKER     ║
╚═══════════════════════╝

👋 Halo ${ctx.from.first_name}!

📋 *Fitur Utama:*
• ✅ Cek Bio WhatsApp
• 🔧 Fix Mode Appeal
• 📊 Premium Features

🔐 *Status:* ${isPremium(ctx.from.id) ? '💎 PREMIUM' : '🔓 FREE'}

Gunakan /menu untuk melihat semua fitur.
  `;

  await ctx.replyWithPhoto(
    { url: 'https://files.catbox.moe/0x7mt1.jpg' },
    {
      caption: welcomeText,
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '📱 Buka Menu', callback_data: 'show_menu' }],
          [{ text: '👤 Owner', url: 'https://t.me/Lunzy2' }]
        ]
      }
    }
  );
});

// MENU COMMAND
bot.command('menu', async (ctx) => {
  const menuText = `
📱 *MAIN MENU*

🛠️ *Tools:*
/cekbio [nomor] - Cek bio WhatsApp
/fix [nomor] - Mode appeal

👑 *Owner Only:*
/pairing [nomor] - Pairing WhatsApp
/addemail email:pass - Tambah email
/delemail email:pass - Hapus email
/listemail - List semua email
/addprem [id] - Tambah premium
/delprem [id] - Hapus premium
/listprem - List user premium

🔄 /start - Menu utama
  `;

  await ctx.reply(menuText, { parse_mode: 'Markdown' });
});

// PREMIUM MANAGEMENT
bot.command('addprem', async (ctx) => {
  if (!isOwner(ctx.from.id)) {
    return ctx.reply('❌ Hanya owner yang bisa menambah premium.');
  }

  let targetId = ctx.message.reply_to_message 
    ? ctx.message.reply_to_message.from.id 
    : ctx.message.text.split(' ')[1];

  if (!targetId) {
    return ctx.reply('❌ Format: /addprem [user_id] atau reply pesan user.');
  }

  targetId = targetId.toString();

  if (!premiumUsers.includes(targetId)) {
    premiumUsers.push(targetId);
    savePremium();
    await ctx.reply(`✅ User ${targetId} berhasil ditambahkan ke premium.`);
  } else {
    await ctx.reply('⚠️ User sudah premium.');
  }
});

bot.command('delprem', async (ctx) => {
  if (!isOwner(ctx.from.id)) {
    return ctx.reply('❌ Hanya owner yang bisa menghapus premium.');
  }

  let targetId = ctx.message.reply_to_message 
    ? ctx.message.reply_to_message.from.id 
    : ctx.message.text.split(' ')[1];

  if (!targetId) {
    return ctx.reply('❌ Format: /delprem [user_id] atau reply pesan user.');
  }

  targetId = targetId.toString();
  const index = premiumUsers.indexOf(targetId);

  if (index > -1) {
    premiumUsers.splice(index, 1);
    savePremium();
    await ctx.reply(`✅ User ${targetId} berhasil dihapus dari premium.`);
  } else {
    await ctx.reply('⚠️ User tidak ditemukan di list premium.');
  }
});

bot.command('listprem', async (ctx) => {
  if (!isOwner(ctx.from.id)) {
    return ctx.reply('❌ Hanya owner yang bisa melihat list premium.');
  }

  if (premiumUsers.length === 0) {
    return ctx.reply('📭 Belum ada user premium.');
  }

  let list = '💎 *DAFTAR USER PREMIUM:*\n\n';
  premiumUsers.forEach((id, index) => {
    list += `${index + 1}. ${id}\n`;
  });

  await ctx.reply(list, { parse_mode: 'Markdown' });
});

// WHATSAPP PAIRING
bot.command('pairing', async (ctx) => {
  if (!isOwner(ctx.from.id)) {
    return ctx.reply('❌ Hanya owner yang bisa melakukan pairing.');
  }

  const phoneNumber = ctx.message.text.split(' ')[1]?.replace(/[^0-9]/g, '');

  if (!phoneNumber) {
    return ctx.reply('❌ Format: /pairing [nomor]\nContoh: /pairing 6281234567890');
  }

  if (!waClient) {
    return ctx.reply('⚠️ WhatsApp client belum siap.');
  }

  try {
    await ctx.reply('⏳ Meminta kode pairing...');
    
    const code = await waClient.requestPairingCode(phoneNumber);
    
    await ctx.reply(
      `📱 *PAIRING CODE*\n\n` +
      `Kode: *${code}*\n\n` +
      `Instruksi:\n` +
      `1. Buka WhatsApp di HP\n` +
      `2. Pilih Menu → Perangkat Tertaut\n` +
      `3. Pilih "Tautkan dengan nomor telepon"\n` +
      `4. Masukkan kode di atas`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    console.error('Pairing error:', error);
    await ctx.reply('❌ Gagal mendapatkan pairing code. Pastikan nomor valid.');
  }
});

// EMAIL MANAGEMENT
bot.command('addemail', async (ctx) => {
  if (!isOwner(ctx.from.id)) {
    return ctx.reply('❌ Hanya owner yang bisa menambah email.');
  }

  const input = ctx.message.text.replace('/addemail', '').trim();
  
  if (!input || !input.includes(':')) {
    return ctx.reply('❌ Format: /addemail email:password\nContoh: /addemail test@gmail.com:password123');
  }

  try {
    const { content, sha } = await githubGetFile();
    const newContent = content.trim() + (content.trim() ? '\n' : '') + input + '\n';
    
    await githubUpdateFile(newContent, sha);
    await ctx.reply('✅ Email berhasil ditambahkan!');
  } catch (error) {
    console.error('Add email error:', error);
    await ctx.reply('❌ Gagal menambahkan email.');
  }
});

bot.command('listemail', async (ctx) => {
  if (!isOwner(ctx.from.id)) {
    return ctx.reply('❌ Hanya owner yang bisa melihat list email.');
  }

  try {
    const { content } = await githubGetFile();
    
    if (!content.trim()) {
      return ctx.reply('📭 Tidak ada data email.');
    }

    const emails = content.trim().split('\n').filter(line => line.trim());
    
    let list = '📧 *DAFTAR EMAIL:*\n\n';
    emails.forEach((email, index) => {
      const [emailPart] = email.split(':');
      list += `${index + 1}. ${emailPart}\n`;
    });

    await ctx.reply(list, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('List email error:', error);
    await ctx.reply('❌ Gagal mengambil data email.');
  }
});

bot.command('delemail', async (ctx) => {
  if (!isOwner(ctx.from.id)) {
    return ctx.reply('❌ Hanya owner yang bisa menghapus email.');
  }

  const emailToDelete = ctx.message.text.split(' ')[1];
  
  if (!emailToDelete) {
    return ctx.reply('❌ Format: /delemail [email]\nContoh: /delemail test@gmail.com');
  }

  try {
    const result = await deleteEmailFromGithub(emailToDelete);
    
    if (result.success) {
      await ctx.reply(`✅ ${result.message}`);
    } else {
      await ctx.reply(`❌ ${result.message}`);
    }
  } catch (error) {
    console.error('Delete email error:', error);
    await ctx.reply('❌ Gagal menghapus email.');
  }
});

// CEK BIO COMMAND
bot.command('cekbio', async (ctx) => {
  if (!isPremium(ctx.from.id) && !isOwner(ctx.from.id)) {
    return ctx.reply('❌ Fitur ini hanya untuk user premium.\nHubungi owner untuk upgrade.');
  }

  const args = ctx.message.text.split(' ').slice(1);
  
  if (args.length === 0) {
    return ctx.reply('❌ Format: /cekbio [nomor1] [nomor2] ...\nContoh: /cekbio 6281234567890 6289876543210');
  }

  // Handle file upload
  if (ctx.message.document) {
    const doc = ctx.message.document;
    
    if (!doc.mime_type.includes('text') && !doc.file_name.endsWith('.txt')) {
      return ctx.reply('❌ File harus berupa .txt');
    }

    try {
      const fileLink = await ctx.telegram.getFileLink(doc.file_id);
      const response = await axios.get(fileLink.href);
      const numbers = response.data.match(/\d+/g) || [];
      
      if (numbers.length === 0) {
        return ctx.reply('❌ Tidak ditemukan nomor dalam file.');
      }

      await handleBioCheck(ctx, numbers);
    } catch (error) {
      console.error('File processing error:', error);
      await ctx.reply('❌ Gagal membaca file.');
    }
  } else {
    await handleBioCheck(ctx, args);
  }
});

// FIX MODE (APPEAL)
bot.command('fix', async (ctx) => {
  const userId = ctx.from.id;
  const args = ctx.message.text.split(' ').slice(1);
  const phoneNumber = args[0];

  if (!phoneNumber) {
    return ctx.reply('❌ Format: /fix [nomor]\nContoh: /fix 6281234567890');
  }

  if (!/^\d{10,15}$/.test(phoneNumber)) {
    return ctx.reply('❌ Nomor tidak valid. Gunakan 10-15 digit angka.');
  }

  // Cooldown check
  const now = Date.now();
  const cooldownTime = 2 * 60 * 1000; // 2 menit
  
  if (userCooldowns[userId] && now < userCooldowns[userId]) {
    const remaining = Math.ceil((userCooldowns[userId] - now) / 1000);
    return ctx.reply(`⏳ Tunggu ${remaining} detik sebelum menggunakan fix lagi.`);
  }

  userCooldowns[userId] = now + cooldownTime;

  try {
    await ctx.reply('⏳ Sedang memproses appeal...');
    
    const result = await callApi('/banding', { nomor: phoneNumber });
    
    const responseText = `
📊 *HASIL APPEAL*

📞 Nomor: ${phoneNumber}
📧 Email: ${result.email || 'Tidak tersedia'}
📝 Status: ${result.success ? '✅ Berhasil' : '❌ Gagal'}
💬 Response: ${result.response || 'Tidak ada response'}
    `;

    await ctx.reply(responseText, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Fix mode error:', error);
    await ctx.reply('❌ Terjadi kesalahan saat proses appeal.');
  }
});

// ==========================
// CALLBACK QUERY HANDLER
// ==========================

bot.on('callback_query', async (ctx) => {
  const action = ctx.callbackQuery.data;
  
  if (action === 'show_menu') {
    await ctx.deleteMessage();
    await ctx.replyWithPhoto(
      { url: 'https://files.catbox.moe/0x7mt1.jpg' },
      {
        caption: '📱 *PILIH MENU*',
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔍 Cek Bio', callback_data: 'menu_cekbio' },
              { text: '🔧 Fix Mode', callback_data: 'menu_fix' }
            ],
            [
              { text: '👑 Owner Menu', callback_data: 'menu_owner' },
              { text: '⭐ Premium', url: 'https://t.me/Lunzy2' }
            ],
            [
              { text: '🔄 Start', callback_data: 'menu_start' }
            ]
          ]
        }
      }
    );
  }
  
  else if (action === 'menu_cekbio') {
    await ctx.editMessageText(
      '🔍 *CEK BIO WHATSAPP*\n\n' +
      'Untuk cek bio, gunakan:\n' +
      '`/cekbio 6281234567890`\n\n' +
      'Atau kirim file .txt berisi list nomor.\n\n' +
      '⚠️ *Note:* Fitur ini hanya untuk user premium.',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali', callback_data: 'show_menu' }]
          ]
        }
      }
    );
  }
  
  else if (action === 'menu_fix') {
    await ctx.editMessageText(
      '🔧 *FIX MODE (APPEAL)*\n\n' +
      'Untuk menggunakan fix mode:\n' +
      '`/fix 6281234567890`\n\n' +
      '⏱️ Cooldown: 2 menit per penggunaan\n\n' +
      '⚠️ *Note:* Masukkan nomor WhatsApp yang ingin di-appeal.',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali', callback_data: 'show_menu' }]
          ]
        }
      }
    );
  }
  
  else if (action === 'menu_owner') {
    if (!isOwner(ctx.from.id)) {
      await ctx.answerCbQuery('❌ Hanya owner yang bisa mengakses menu ini.', { show_alert: true });
      return;
    }
    
    await ctx.editMessageText(
      '👑 *OWNER MENU*\n\n' +
      '📱 WhatsApp:\n' +
      '`/pairing [nomor]` - Pairing WhatsApp\n\n' +
      '📧 Email Management:\n' +
      '`/addemail email:pass` - Tambah email\n' +
      '`/delemail [email]` - Hapus email\n' +
      '`/listemail` - List semua email\n\n' +
      '⭐ Premium Management:\n' +
      '`/addprem [id]` - Tambah premium\n' +
      '`/delprem [id]` - Hapus premium\n' +
      '`/listprem` - List user premium',
      { 
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 Kembali', callback_data: 'show_menu' }]
          ]
        }
      }
    );
  }
  
  else if (action === 'menu_start') {
    await ctx.deleteMessage();
    ctx.telegram.sendMessage(
      ctx.chat.id,
      'ℹ️ Gunakan /start untuk memulai bot.'
    );
  }
  
  await ctx.answerCbQuery();
});

// ==========================
// ERROR HANDLING
// ==========================

bot.catch((err, ctx) => {
  console.error(`Error for ${ctx.updateType}:`, err);
  if (ctx.chat) {
    ctx.reply('❌ Terjadi kesalahan. Silakan coba lagi nanti.');
  }
});

// ==========================
// START BOT
// ==========================

async function startBot() {
  try {
    // Start WhatsApp client
    await startWhatsAppClient();
    
    // Start Telegram bot
    await bot.launch();
    
    console.log('🤖 Bot Telegram berhasil dijalankan!');
    console.log('📱 WhatsApp client starting...');
    
    // Enable graceful stop
    process.once('SIGINT', () => bot.stop('SIGINT'));
    process.once('SIGTERM', () => bot.stop('SIGTERM'));
    
  } catch (error) {
    console.error('Failed to start bot:', error);
  }
}

// Run the bot
startBot();
