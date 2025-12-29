const { Telegraf } = require('telegraf');
const fetch = require('node-fetch');
const axios = require('axios');
const fs = require('fs');
const pino = require('pino');
const { Boom } = require('@hapi/boom');
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestWaWebVersion } = require('@whiskeysockets/baileys');


// ==========================
//GANTI ALL DLID INI
// KONFIGURASI DASAR 
const ADMIN_ID = 8248734943;
const ADMIN = 8248734943;
const OWNER = "8248734943";
// ==========================
const BOT_TOKEN = '8525102753:AAEUMWcS1K5oYJVM-sBhvfl6wLtU34HBjPU';


//yabg ini jangan di ganti kecuali admin mengatakan apikey ganti ke xxx lalu ganti apkikey misal adminv ganti menjadi memek nah ganti sudah itu run aja 
//by lunzy kontol

const API_KEY = 'adminnn';
const BASE_URL = 'https://team-lunzy-and-rezz.vercel.app/api';
const bot = new Telegraf(BOT_TOKEN);

let waClient = null;
let waConnectionStatus = false;
const userCooldowns = {}; // { userId: timestamp_end_cooldown }

// =========================
// CONFIG GITHUB
// =========================
const { Octokit } = require("@octokit/rest");


//ganti id tele mu


// ==========================
// HELPER FUNCTION UMUM
// ==========================

function formatResult(data) {
  let out = '';
  if (data.success !== undefined)
    out += `${data.success ? '✅ Berhasil' : '❌ Gagal'}`;
  if (data.email) out += `• Email: ${data.email}\n`;
  if (data.subject) out += `• Subjek: ${data.subject}\n`;
  if (data.response) out += `• Respon: ${data.response}\n`;
  return out;
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}
//pepelekeb

const GITHUB_TOKEN = "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"; // <- isi sendiri
const GITHUB_OWNER = "F12241";
const GITHUB_REPO = "team-lunzy-and-rezz";
const GITHUB_FILE = "dataimel.txt";
const GITHUB_BRANCH = "main";


const octokit = new Octokit({ auth: GITHUB_TOKEN });

async function deleteEmailFromGithub(target) {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`;

    const res = await axios.get(url, {
      headers: { Authorization: `token ${GITHUB_TOKEN}` }
    });

    const sha = res.data.sha;
    const content = Buffer.from(res.data.content, "base64").toString("utf8");

    // Hapus baris yang cocok
    const newContent = content
      .split("\n")
      .filter(line => line.trim() !== target.trim())
      .join("\n");

    if (newContent === content) {
      return { success: false, message: "Data tidak ditemukan." };
    }

    // Upload ulang
    await axios.put(
      url,
      {
        message: `Delete email: ${target}`,
        content: Buffer.from(newContent, "utf8").toString("base64"),
        sha
      },
      {
        headers: { Authorization: `token ${GITHUB_TOKEN}` }
      }
    );

    return { success: true, message: "Berhasil menghapus." };

  } catch (e) {
    console.log(e.response?.data || e);
    return { success: false, message: e.response?.data?.message || e.message };
  }
}


    
async function githubGetFileRaw() {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${GITHUB_FILE}`;
    const res = await axios.get(url, {
      headers: { Authorization: `Bearer ${GITHUB_TOKEN}` }
    });

    return {
      content: Buffer.from(res.data.content, "base64").toString("utf8"),
      sha: res.data.sha
    };

  } catch (err) {
    if (err.response && err.response.status === 404) {
      return { content: "", sha: null };
    }
    throw err;
  }
}
//github
async function githubGetFile() {
  try {
    const res = await octokit.repos.getContent({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: GITHUB_FILE,
      ref: GITHUB_BRANCH
    });

    const content = Buffer.from(res.data.content, "base64").toString("utf8");
    return { content, sha: res.data.sha };

  } catch (err) {
    if (err.status === 404) return { content: "", sha: null };
    throw err;
  }
}

async function githubUpdateFile(newContent, sha) {
  return await octokit.repos.createOrUpdateFileContents({
    owner: GITHUB_OWNER,
    repo: GITHUB_REPO,
    path: GITHUB_FILE,
    message: "Update via Telegram Bot",
    content: Buffer.from(newContent).toString("base64"),
    sha: sha || undefined,
    branch: GITHUB_BRANCH
  });
}
// ==========================
// FITUR PREMIUM USER
// ==========================

async function startWhatsAppClient() {
  console.log("🚀 Memulai koneksi WhatsApp...")

  const { state, saveCreds } = await useMultiFileAuthState('./session')
  const { version } = await fetchLatestWaWebVersion()

  waClient = makeWASocket({
    auth: state,
    logger: pino({ level: "silent" }),
    printQRInTerminal: false,
    version,
    browser: ["Ubuntu", "Chrome", "20.0.00"]
  })

  waClient.ev.on("creds.update", saveCreds)

  waClient.ev.on("connection.update", (update) => {
  const { connection, lastDisconnect } = update

  if (connection === "close") {
    waConnectionStatus = false
    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
    const reconnect = reason !== DisconnectReason.loggedOut

    console.log("❌ WA Disconnect:", reason)

    if (reconnect) {
      console.log("🔄 Reconnect 5 detik...")
      setTimeout(startWhatsAppClient, 5000)
    } else {
      console.log("🛑 Logout. Hapus folder session untuk pairing ulang.")
      waClient = null
    }
  }

  if (connection === "open") {
    waConnectionStatus = true
    console.log("✅ WhatsApp terhubung!")
   }
 })
}
startWhatsAppClient()
// ===========================
// HANDLE CEK BIO
// (tidak diubah dari versi asli)
async function handleBioCheck(ctx, numbersToCheck) {
  if (!waConnectionStatus)
    return ctx.telegram.sendMessage(
      ctx.chat.id,
      "⚠️ WA belum konek, silahkan pairing nomor dulu ke owner."
    )

  if (numbersToCheck.length === 0)
    return ctx.telegram.sendMessage(
      ctx.chat.id,
      "Nomornya mana, Woi?"
    )

  await ctx.telegram.sendMessage(
    ctx.chat.id,
    `🔍 OKE 🚀🔥, mau ngecek bio nomor mu dengan total ${numbersToCheck.length} Lagi Di Cek.`
  )

  let withBio = []
  let noBio = []
  let notRegistered = []

  const jids = numbersToCheck.map(n => n.trim() + "@s.whatsapp.net")
  const existenceResults = await waClient.onWhatsApp(...jids)

  const registeredJids = []
  existenceResults.forEach(r => {
    if (r.exists) registeredJids.push(r.jid)
    else notRegistered.push(r.jid.split("@")[0])
  })

  const registeredNumbers = registeredJids.map(j => j.split("@")[0])

  if (registeredNumbers.length > 0) {
    const batchSize = 15
    for (let i = 0; i < registeredNumbers.length; i += batchSize) {
      const batch = registeredNumbers.slice(i, i + batchSize)

      const promises = batch.map(async nomor => {
        const jid = nomor + "@s.whatsapp.net"
        try {
          const statusResult = await waClient.fetchStatus(jid)

          let bioText = null
          let setAtText = null

          if (statusResult) {
            if (typeof statusResult.status === "string") {
              bioText = statusResult.status
              setAtText = statusResult.setAt
            } else if (typeof statusResult.status === "object" && statusResult.status !== null) {
              bioText = statusResult.status.text || statusResult.status.status
              setAtText = statusResult.status.setAt || statusResult.setAt
            }
          }

          if (bioText && bioText.trim()) {
            withBio.push({ nomor, bio: bioText, setAt: setAtText })
          } else {
            noBio.push(nomor)
          }
        } catch {
          notRegistered.push(nomor)
        }
      })

      await Promise.allSettled(promises)
      await sleep(1000)
    }
  }

  let fileContent = "HASIL CEK BIO SEMUA USER\n\n"
  fileContent += `Total dicek : ${numbersToCheck.length}\n`
  fileContent += `Dengan Bio : ${withBio.length}\n`
  fileContent += `Tanpa Bio  : ${noBio.length}\n`
  fileContent += `Tidak Terdaftar : ${notRegistered.length}\n\n`

  if (withBio.length > 0) {
    fileContent += "==============================\n"
    fileContent += "NOMOR DENGAN BIO\n\n"

    withBio.forEach(item => {
      const d = new Date(item.setAt)
      const waktu = !isNaN(d)
        ? d.toLocaleString("id-ID")
        : "Tidak diketahui"

      fileContent += `${item.nomor}\n`
      fileContent += `Bio   : ${item.bio}\n`
      fileContent += `Date  : ${waktu}\n\n`
    })
  }

  fileContent += "==============================\n"
  fileContent += "NOMOR TANPA BIO / PRIVASI\n\n"

  if (noBio.length > 0) {
    noBio.forEach(n => {
      fileContent += `${n}\n`
    })
  } else {
    fileContent += "(Kosong)\n"
  }

  const filePath = `./hasil_cekbio_${ctx.from.id}.txt`
  fs.writeFileSync(filePath, fileContent)

  await ctx.telegram.sendDocument(
    ctx.chat.id,
    { source: filePath },
    { caption: "Nih hasilnya boskuu." }
  )

  fs.unlinkSync(filePath)
}

// ==========================
//  COMMANDS TELEGRAM (addprem/delprem/listprem/pairing/cek/broadcast) kept as original

bot.command("pairing", async (ctx) => {
  const phoneNumber = ctx.message.text
    .split(" ")[1]
    ?.replace(/[^0-9]/g, "")

  if (!phoneNumber) {
    return ctx.reply(
      "❌ *Format salah*\nGunakan:\n`/pairing 628xxxxxxxxx`",
      { parse_mode: "Markdown" }
    )
  }

  if (!waClient || !waClient.authState) {
    return ctx.reply("⚠️ WA belum siap, tunggu sebentar.")
  }

  if (waClient.authState.creds.registered) {
    return ctx.reply("✅ WhatsApp sudah terhubung, tidak perlu pairing.")
  }

  try {
    await ctx.reply("⏳ Meminta kode pairing...")

    const code = await waClient.requestPairingCode(phoneNumber)

    await ctx.reply(
      `📲 *PAIRING CODE*\n\n` +
      `*${code}*\n\n` +
      `Masukkan di WhatsApp:\n` +
      `Perangkat Tertaut → Tautkan dengan nomor`,
      { parse_mode: "Markdown" }
    )

    console.log("PAIRING CODE:", code)

  } catch (err) {
    console.error(err)
    ctx.reply("❌ Gagal minta pairing code.\nPastikan nomor benar.")
  }
})

bot.command('cekbio', async (ctx) => {
  const nums = ctx.message.text.split(' ').slice(1).join(' ').match(/\d+/g) || [];
  await handleBioCheck(ctx, nums);
});

bot.on('document', async (ctx) => {
  const doc = ctx.message.document;
  const allowedTypes = ['text/plain', 'text/csv'];

  if (!allowedTypes.includes(doc.mime_type)) {
    return ctx.reply("Filenya harus format .txt atau .csv ya bos!");
  }

  try {
    const fileLink = await ctx.telegram.getFileLink(doc.file_id);
    const response = await axios.get(fileLink.href, { responseType: 'arraybuffer' });
    const data = Buffer.from(response.data, 'binary').toString('utf-8');
    const numbers = data.match(/\d+/g) || [];
    if (numbers.length === 0) return ctx.reply("❌ Tidak ditemukan nomor di file.");
    await handleBioCheck(ctx, numbers);
  } catch (err) {
    console.error(err);
    ctx.reply("❌ Gagal membaca file, coba lagi bos.");
  }
});
// ==========================
// FITUR KHUSUS GRUP
// ==========================


const premiumFile = './premium.json';
let premiumUsers = fs.existsSync(premiumFile)
  ? JSON.parse(fs.readFileSync(premiumFile))
  : [];

function savePremium() {
  fs.writeFileSync(premiumFile, JSON.stringify(premiumUsers, null, 2));
}

function isPremium(id) {
  return premiumUsers.includes(id);
}

// GANTI ID ADMIN DENGAN ID KAMU SENDIRI


bot.command('listgrup', async (ctx) => {
  if (ctx.from.id.toString() !== OWNER) {
    return ctx.reply("❌ Hanya OWNER yang bisa melihat daftar grup.");
  }

  if (grupList.length === 0) {
    return ctx.reply("📭 Tidak ada grup yang terdaftar.");
  }

  let text = "📌 *Daftar Grup Terdaftar:*\n\n";
  grupList.forEach((id, i) => {
    text += `${i + 1}. \`${id}\`\n`;
  });

  ctx.replyWithMarkdown(text);
});
// ➕ ADDPREM
bot.command('addprem', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Hanya admin yang bisa menambah premium.');
  let targetId = ctx.message.reply_to_message
    ? ctx.message.reply_to_message.from.id
    : parseInt(ctx.message.text.split(' ')[1]);
  if (!targetId) return ctx.reply('❌ Gunakan: /addprem <id> atau reply pesan user.');
  if (!premiumUsers.includes(targetId)) {
    premiumUsers.push(targetId);
    savePremium();
    ctx.reply(`✅ User ${targetId} ditambahkan ke daftar premium.`);
  } else ctx.reply('⚠️ User sudah premium.');
});

// ➖ DELPREM
bot.command('delprem', async (ctx) => {
  if (ctx.from.id !== ADMIN_ID) return ctx.reply('❌ Hanya admin yang bisa menghapus premium.');
  let targetId = ctx.message.reply_to_message
    ? ctx.message.reply_to_message.from.id
    : parseInt(ctx.message.text.split(' ')[1]);
  if (!targetId) return ctx.reply('❌ Gunakan: /delprem <id> atau reply pesan user.');
  if (premiumUsers.includes(targetId)) {
    premiumUsers = premiumUsers.filter(id => id !== targetId);
    savePremium();
    ctx.reply(`✅ User ${targetId} dihapus dari daftar premium.`);
  } else ctx.reply('⚠️ User tidak ada di daftar premium.');
});

// 📜 LISTPREM
bot.command('listprem', async (ctx) => {
  if (!premiumUsers.length) return ctx.reply('📭 Belum ada user premium.');
  const list = premiumUsers.map((id, i) => `${i + 1}. ${id}`).join('\n');
  ctx.reply(`💎 *Daftar Premium:*\n${list}`, { parse_mode: 'Markdown' });
});

// ==========================
// PROTEKSI PREMIUM UNTUK FITUR LAIN
// ==========================

// Middleware global (cek semua command selain /start dan fitur admin)
// Middleware global (cek semua command selain /start dan fitur admin)
bot.use(async (ctx, next) => {
  const isAdmin = ctx.from?.id === ADMIN_ID;
  const message = ctx.message?.text || "";
  const command = message.split(' ')[0].toLowerCase();

  // command bebas: start & admin
  const allowed = ['/start', '/addprem', '/delprem', '/listprem'];

  if (ctx.updateType === 'message' && command.startsWith('/')) {
    if (!allowed.includes(command) && !isAdmin && !isPremium(ctx.from.id)) {
      return ctx.reply('❌ Fitur ini hanya untuk user premium.\nHubungi admin untuk akses premium.');
    }
  }

  await next();
});
// ==========================
// WHATSAPP CLIENT (BAILEYS)
// ==========================

// Helper
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}


bot.command("addemail", async (ctx) => {
  // HANYA OWNER / ADMIN YANG BOLEH
  if (ctx.from.id !== ADMIN) {
    return ctx.reply("❌ Perintah ini hanya untuk OWNER.");
  }

  const text = ctx.message.text.replace("/addemail", "").trim();

  if (!text || !text.includes(":")) {
    return ctx.reply("⚠️ Format salah.\nGunakan:\n`/addemail email:pass`", {
      parse_mode: "Markdown"
    });
  }

  try {
    const { content, sha } = await githubGetFile();
    const newContent = (content ? content.trim() + "\n" : "") + text + "\n";

    await githubUpdateFile(newContent, sha);

    ctx.reply("✅ email berhasil ditambahkan !");
  } catch (err) {
    console.error(err);
    ctx.reply("❌ Gagal add email  .");
  }
});



bot.command("listemail", async (ctx) => {
  if (ctx.from.id !== ADMIN)
    return ctx.reply("❌ Perintah ini hanya untuk OWNER.");

  try {
    const { content } = await githubGetFileRaw();

    if (!content.trim())
      return ctx.reply("📭 Tidak ada data email.");

    const list = content
      .trim()
      .split("\n")
      .map((v, i) => `${i + 1}. ${v}`)
      .join("\n");

    ctx.reply(`📄 *List Email:*\n${list}`, { parse_mode: "Markdown" });

  } catch (err) {
    console.log(err);
    ctx.reply("❌ Gagal mengambil data ");
  }
});

bot.command("delemail", async (ctx) => {
  const userId = ctx.from.id.toString();
  const message = ctx.message.text;

  if (userId !== OWNER) {
    return ctx.reply("❌ Kamu tidak memiliki akses menggunakan perintah ini.");
  }

  const target = message.split(" ")[1];

  if (!target || !target.includes("@") || !target.includes(":")) {
    return ctx.reply("⚠️ Format salah!\nContoh:\n/delemail email:password");
  }

  await ctx.reply("🧹 Menghapus email!!.");

  try {
    const result = await deleteEmailFromGithub(target);

    if (result.success) {
      ctx.reply(`✅ Berhasil dihapus:\n${target}`);
    } else {
      ctx.reply(`❌ Gagal menghapus:\n${result.message}`);
    }

  } catch (err) {
    console.log(err);
    ctx.reply("❌ Error server, cek console.");
  }
});


// Helper: panggil API
async function callApi(endpoint, params = {}) {
  const url = new URL(BASE_URL + endpoint);
  params.apikey = API_KEY;
  Object.keys(params).forEach(k => url.searchParams.append(k, params[k]));
  const res = await fetch(url.toString());
  return res.json();
}



// ==========================

// ==========================
function dashboardText() {
  return (
` 
\`\`\`
╭─────────────────────────────╮
│[ ʜᴇʟᴏ ɪ ᴀᴍ ᴛʜᴇ ʀᴇᴅ ғɪx ʙᴏᴛ x ᴄʜᴇᴋ ʙɪᴏ ]
│     𖤐 [ ɪᴍ ʀᴇᴀᴅʏ ᴛᴏ ʜᴇʟᴘ ʏᴏᴜ ] 𖤐  
╰─────────────────────────────╯
\`\`\`
\`\`\`
╭─────────────────────────────╮
│⏤ [ ᴅᴀsʙᴏᴀʀᴅ sɪsᴛᴇᴍ 𖤐 ]     
│⬡ [ ᴅᴇᴠᴇʟᴏᴠᴇʀ ] : [ Nortxh𖤐 ]          
│⬡ [ ᴠᴇʀsɪᴏɴ ] : 3.1.1.2                 
│⬡ [ ɢᴇɴ ]: 5 𖤐  
│ sᴜᴘʀᴏᴛ Nortxh 𖤐                
╰─────────────────────────────╯
\`\`\``
  );
}
bot.start((ctx) => {
  ctx.replyWithPhoto(
    { url: "https://files.catbox.moe/0x7mt1.jpg" }, // bebas, ganti link fotomu sendiri
    {
      caption: dashboardText(),
      parse_mode: "Markdown",
      reply_markup: {
        inline_keyboard: [
         [
          { text: '[ 𖤐 ғɪx ᴍᴇʀᴀʜ ᴍᴇɴᴜ 𖤐] ', callback_data: 'banding' },
          { text: '[ 𖤐 ᴏᴡɴᴇʀ ᴍᴇɴᴜ 𖤐 ]', callback_data: 'menuowner' }
         ],
         [
           { text: '[ 𖤐 ᴄᴇᴋ ʙɪᴏ ᴍᴇɴᴜ 𖤐 ]', callback_data: 'cek' },
           { text: '[𖤐ᴛʜᴀɴᴋ ᴛᴏ/ʙᴇsᴛ ғʀɪᴇɴᴅ𖤐]', callback_data: 'besti' }
        ],
        [
           { text: '[ 𖤐 ʙᴜʏ sᴄʀɪᴘᴛ? 𖤐 ]', url: 't.me/Lunzy2' }
        ]
       ]
      }
    }
  );
});
// 🎯 Command /start → kirim dashboard utama
bot.start((ctx) => {
  ctx.replyWithMarkdown(dashboardText(), dashboardMenu());
});

// Handler tombol utama dashboard
bot.on('callback_query', async (ctx) => {
  const action = ctx.callbackQuery.data;
  const msgId = ctx.callbackQuery.message.message_id;
  const chatId = ctx.callbackQuery.message.chat.id;

  try {

    // =======================
    // DASHBOARD UTAMA
    // =======================
    if (action === 'menu') {
      await ctx.telegram.editMessageMedia(
        chatId,
        msgId,
        undefined,
        {
          type: 'photo',
          media: 'https://files.catbox.moe/0x7mt1.jpg',
          caption: dashboardText(),
          parse_mode: 'Markdown'
        },
        {
          reply_markup: {
            inline_keyboard: [
         [
          { text: '[ 𖤐 ғɪx ᴍᴇʀᴀʜ ᴍᴇɴᴜ 𖤐] ', callback_data: 'banding' },
          { text: '[ 𖤐 ᴏᴡɴᴇʀ ᴍᴇɴᴜ 𖤐 ]', callback_data: 'menuowner' }
         ],
         [
           { text: '[ 𖤐 ᴄᴇᴋ ʙɪᴏ ᴍᴇɴᴜ 𖤐 ]', callback_data: 'cek' },
           { text: '[𖤐ᴛʜᴀɴᴋ ᴛᴏ/ʙᴇsᴛ ғʀɪᴇɴᴅ𖤐]', callback_data: 'besti' }
        ],
        [
           { text: '[ 𖤐 ʙᴜʏ sᴄʀɪᴘᴛ? 𖤐 ]', url: 't.me/Lunzy2' }]
            ]
          }
        }
      );
      return;
    }


    // =======================
    // APPEAL MODE / BANDING
        if (action === 'banding') {
      await ctx.telegram.editMessageMedia(
        chatId,
        msgId,
        undefined,
        {
          type: 'photo',
          media: 'https://files.catbox.moe/0x7mt1.jpg',
          caption:
            '╭───────[ 𖤐 ᴀᴘᴘᴇᴀʟ ᴍᴏᴅᴇ 𖤐 ]───────\n' +
            '│ Use the format:\n' +
            '│ `/fix <nomor>`\n' +
            '│ example: `/fix 628123456789`\n' +
            '│\n' +
            '│ 🔹 The red fix is text says contact us\n' +
            '╰───────────────────────\n' +
            'ᴀᴘᴘᴇᴀʟ ᴍᴏᴅᴇ ʙʏ ʟᴜɴᴢʏ',
          parse_mode: 'Markdown'
        },
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔁', callback_data: 'menu' }]
            ]
          }
        }
      );
      return;
    }
    
    
        if (action === 'cek') {
      await ctx.telegram.editMessageMedia(
        chatId,
        msgId,
        undefined,
        {
          type: 'photo',
          media: 'https://files.catbox.moe/0x7mt1.jpg',
          caption:
'╭───────[ 𖤐 ᴄʜᴇᴋ ʙɪᴏ ᴍᴇɴᴜ 𖤐 ]───────\n' +
'│ /cekbio no1 no2 ...\n' +
'│ Cek bio documen kirim txt/xlsx\n' +
'╰──────────────────────────\n' +
            'ᴄʜᴇᴋ ʙɪᴏ ᴍᴇɴᴜ ʙʏ ʟᴜɴᴢʏ',           
          parse_mode: 'Markdown'
        },
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔁', callback_data: 'menu' }]
            ]
          }
        }
      );
      return;
    }
    // =======================
    if (action === 'besti') {
      await ctx.telegram.editMessageMedia(
        chatId,
        msgId,
        undefined,
        {
          type: 'photo',
          media: 'https://files.catbox.moe/0x7mt1.jpg',
          caption:
'╭─────────[ 𖤐 ʙᴇsᴛ ғʀɪᴇɴᴅ 𖤐 ]──────\n' +
'│ ᴛʜᴀɴᴋ ʏᴏᴜ ᴛᴏ ᴛᴇᴀᴍ \n' +
'│ ᴀʟʟᴀʜ sᴡᴛ \n' +
'│ ʟᴜɴᴢʏ ᴅᴇᴠ ᴛᴇᴀᴍ\n' +
'│ ʀᴇᴢᴢ ᴘᴛ/ʙᴇsᴛ ғʀɪᴇɴᴅ\n' +
'│ ʜᴀɴᴢ sᴇᴄᴜʀɪᴛʏ/ʙᴇsᴛ ғʀɪᴇɴᴅ\n' +
'│ ᴢᴇᴀɴ ᴘᴛ/ʙᴇsᴛ ғʀɪᴇɴᴅ\n' +
'╰──────────────────────────\n' +
            'ᴛʜᴀɴᴋ ʏᴏᴜ',           
          parse_mode: 'Markdown'
        },
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔁', callback_data: 'menu' }]
            ]
          }
        }
      );
      return;
    }
    // =======================
    //
        if (action === 'menuowner') {
      await ctx.telegram.editMessageMedia(
        chatId,
        msgId,
        undefined,
        {
          type: 'photo',
          media: 'https://files.catbox.moe/0x7mt1.jpg',
          caption:
'╭──────────[ 𖤐 ᴏᴡɴᴇʀ 𖤐 ]─────────\n' +
'│ /addemal\n' +
'│ /delemail\n' +
'│ /listemail\n' +
'│ /addprem\n' +
'│ /addprem\n' +
'│ /pairing\n' +
'╰──────────────────────────\n' +
            'ᴏᴡɴᴇʀ ᴍᴇɴᴜ ʙʏ ʟᴜɴᴢʏ',           
          parse_mode: 'Markdown'
        },
        {
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔁', callback_data: 'menu' }]
            ]
          }
        }
      );
      return;
    }
    

  } catch (err) {
    console.error('Callback Error:', err);
    await ctx.answerCbQuery(`❌ Error: ${err.message}`, { show_alert: true });
  }

  await ctx.answerCbQuery();
});







// 📲 MODE BANDING (COOLDOWN 120s)
bot.command('fix', async (ctx) => {
  const userId = ctx.from.id;
  const now = Date.now();

  const args = ctx.message.text.split(' ').slice(1);
  const nomor = args[0]?.trim();

  if (!nomor) {
    return ctx.replyWithMarkdown(
      '⚠️ Kirim nomor setelah command.\n\n📌 *Contoh:*\n`/banding 6281234567890`'
    );
  }

  if (!/^\d{8,15}$/.test(nomor)) {
    return ctx.reply('❌ Nomor tidak valid. Gunakan hanya angka tanpa spasi atau simbol.');
  }

  // COOLDOWN
  const cooldownEnd = userCooldowns[userId] || 0;
  if (now < cooldownEnd) {
    const wait = Math.ceil((cooldownEnd - now) / 1000);
    return ctx.reply(`🕓 Tunggu ${wait}s sebelum bisa cek nomor lagi.`);
  }

  // MULAI COOLDOWN
 

  try {
    const data = await callApi('/banding', { nomor });

    const resultText = `ғᴏʀᴍᴀᴛ ʟᴀᴘᴏʀᴀɴ.ᴀɴᴅᴀ
╭──────────────────────
│📞 ɴᴏᴍᴏᴛ : *${nomor}*
│📊 sᴛᴀᴛᴜs : ${formatResult(data)}
│📂 ᴇᴍᴀɪʟ: ${data.email}
│📬 ᴛᴜᴊᴜᴀɴ: WhatsApp Support
╰──────────────────────`;

    await ctx.replyWithMarkdown(resultText);
  } catch (err) {
    await ctx.reply(`❌ Terjadi kesalahan: ${err.message}`);
  }
});

bot.launch().then(() => console.log('🤖 BOT TELE AKTIF | WA CLIENT JALAN ✅'));

