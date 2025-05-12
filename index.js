/*
 * Script By Nazir
 * Forbidden to delete my wm
 * Github : Nazir99inf
 * WhatsApp : wa.me/6285822146627
 */

const axios = require('axios');
const {
  default: makeWASocket,
  jidDecode,
  Browsers,
  DisconnectReason,
  useMultiFileAuthState,
} = require('baileys');
const readline = require('readline');
const pino = require('pino');
const chalk = require('chalk');
require('./settings');

global.deepSeekSessions = global.deepSeekSessions || new Map();
const sessions = global.deepSeekSessions;
const MAX_MESSAGES = 100;
const EXPIRY_MS = 3 * 60 * 60 * 1000; // 3 hours
const CLEANUP_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

// generate unique session ID
const generateId = () =>
  'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);

// Periodic cleanup of expired sessions
setInterval(() => {
  const now = Date.now();
  for (const [id, sess] of sessions.entries()) {
    if (now - sess.lastActive > EXPIRY_MS) {
      sessions.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * DeepSeek scraping logic
 */
async function deepSeekScrape(text, { sessionId = null, think = false } = {}) {
  if (!text || !text.trim()) {
    throw new Error("Inputnya mana?? Mau ngechat DeepSeek masa kosong begitu inputnya 🗿");
  }
  if (sessionId && !sessions.has(sessionId)) {
    throw new Error("Session expired bree! Session cuma berlaku 3 jam doang 😆");
  }

  if (!sessionId) sessionId = generateId();

  const existing = sessions.get(sessionId)?.messages || [];
  const messages = [
    { role: "system", content: "You are an AI ... (atur personality di sini)" },
    ...existing,
    { role: "user", content: text.trim() },
  ];

  const response = await axios.post(
    'https://qfjcjtsklspbzxszcwmf.supabase.co/functions/v1/proxyDeepSeek',
    {
      model: "deepseek-r1-distill-llama-70b",
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      temperature: 0.9,
      max_tokens: 1024,
      top_p: 0.95,
      stream: false,
    },
    {
      headers: {
        'User-Agent': 'Postify/1.0.0',
        'Content-Type': 'application/json',
      },
    }
  );

  let content = response.data.choices[0].message.content;
  if (!think) content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();

  const now = Date.now();
  const updated = [
    ...existing,
    { role: 'user', content: text.trim(), timestamp: now },
    { role: 'assistant', content, timestamp: now },
  ].slice(-MAX_MESSAGES);

  sessions.set(sessionId, { messages: updated, lastActive: now });
  return { content, sessionId };
}

/**
 * Prompt helper using readline
 */
const question = text => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => rl.question(text, ans => {
    rl.close();
    resolve(ans.trim());
  }));
};

/**
 * Initialize WhatsApp socket
 */
async function System() {
  const { state, saveCreds } = await useMultiFileAuthState('session');
  const sock = makeWASocket({
    logger: pino({ level: 'silent' }),
    auth: state,
    printQRInTerminal: false,
    markOnlineOnConnect: false,
    browser: Browsers.windows('Edge'),
  });

  // decodeJid helper
  sock.decodeJid = jid => {
    if (!jid) return jid;
    if (/:\d+@/gi.test(jid)) {
      const d = jidDecode(jid) || {};
      return (d.user && d.server && `${d.user}@${d.server}`) || jid;
    }
    return jid;
  };

  // Pairing jika belum registered
  if (!sock.authState.creds.registered) {
    const phone = await question('Masukan nomor WhatsApp kamu (62): ');
    let code = await sock.requestPairingCode(phone, 'NAZIR999');
    code = code.match(/.{1,4}/g)?.join('-') || code;
    console.log('Pairing code:', code);
  }

  // Connection lifecycle
  sock.ev.on('connection.update', async update => {
    const { connection, lastDisconnect } = update;
    if (connection === 'connecting') {
      console.log('Koneksi pending');
    } else if (connection === 'close') {
      console.log('Koneksi terputus, reconnecting...');
      System();
    } else if (connection === 'open') {
      console.log('Koneksi tersambung');
      console.log('- Name:', sock.user.name || 'Nazir');
      await sock.newsletterFollow("120363391202311948@newsletter");
    }
  });

  // Incoming messages
  sock.ev.on('messages.upsert', async up => {
    const msg = up.messages[0];
    if (!msg || !msg.message || msg.key.fromMe) return;

    const jid = sock.decodeJid(msg.key.remoteJid);
    const isPrivate = jid.endsWith('@s.whatsapp.net');
    const textMsg = msg.message.conversation
      || msg.message.extendedTextMessage?.text
      || '';

    // AI chat
    if (isPrivate && textMsg.trim() && global.settings.autoai) {
        await sock.sendPresenceUpdate('composing', jid);
        const { content, sessionId } = await deepSeekScrape(textMsg);
        const safe = content.replace(/\*\*(.*?)\*\*/g, '*$1*');
        await sock.sendMessage(
          jid,
          {
            text: `*AUTO AI:*\n${safe}\n\n_Session ID: ${sessionId}_`,
            contextInfo: {
              externalAdReply: {
                showAdAttribution: true,
                mediaType: 0,
                title: 'Deepseek R1 70b',
                body: 'Powered By Nazir',
                sourceUrl: 'https://chatbot.nazirganz.space',
                thumbnailUrl: 'https://i.pinimg.com/originals/28/70/d2/2870d28de38259d5c500562fe9f334b9.png',
              },
            },
          },
          { quoted: msg }
        );
        console.log(
          chalk.green.bold(`[ RECEIVED MESSAGE ]\n`) +
          + chalk.white.bold(`From:`) + chalk.cyan.bold(msg.pushName || 'Unknown') + "\n" +
          chalk.white.bold(`JID: `) + chalk.yellow.bold(jid) + '\n' +
          chalk.white.bold('Text:') + chalk.cyan.bold(textMsg)
        );
    }

    // Auto-react story
    const isStatus = msg.key.remoteJid === 'status@broadcast';
    if (global.settings.autoreact && isStatus && !msg.key.fromMe) {
      const now = Date.now();
      const msgTime = msg.messageTimestamp * 1000;
      if (now - msgTime <= 5 * 60 * 1000) {
        await sock.readMessages([msg.key]);
        const emoji = global.emoji[Math.floor(Math.random() * global.emoji.length)];
        await sock.sendMessage(
          'status@broadcast',
          { react: { key: msg.key, text: emoji } },
          { statusJidList: [msg.key.participant, sock.decodeJid(sock.user.id)] }
        ).catch(() => {});
        console.log(
          chalk.magenta.bold('[REACTION STORY]\n') +
          chalk.white.bold(`Name:`) + chalk.cyan.bold(msg.pushName) + "\n" +
          chalk.white.bold(`Emoji:`) + chalk.yellow.bold(emoji)
        );
      }
    }

    // Auto-read private messages
    if (global.settings.autoread && isPrivate) {
      await sock.readMessages([msg.key]);
      console.log(
        chalk.blue.bold(`[READING MESSAGE]\n`) +
        chalk.white.bold(`Name:`) + chalk.cyan.bold(msg.pushName || 'Unknown') + `\n` +
        chalk.white.bold(`JID:`) + chalk.yellow.bold(jid)
      );
    }
  });

  // Anti-call
  sock.ev.on('call', async calls => {
    const call = calls[0];
    if (global.settings.anticall) {
      await sock.sendMessage(call.from, { text: 'Saat ini saya tidak dapat menerima panggilan Anda.' });
    }
  });

  sock.ev.on('creds.update', saveCreds);
}

System();
