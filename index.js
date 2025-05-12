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

const generateId = () => 
  'sess-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 8);

// Periodic cleanup of expired sessions\ nsetInterval(() => {
  const now = Date.now();
  for (const [id, sess] of sessions.entries()) {
    if (now - sess.lastActive > EXPIRY_MS) {
      sessions.delete(id);
    }
  }
}, CLEANUP_INTERVAL_MS);

/**
 * DeepSeek scraping logic
 * @param {string} text User input text
 * @param {object} options Options object
 * @param {string|null} options.sessionId Existing session ID or null
 * @param {boolean} options.think Whether to include <think> tags
 */
async function deepSeekScrape(text, { sessionId = null, think = false } = {}) {
  if (!text || !text.trim()) {
    throw new Error("Inputnya mana?? Mau ngechat DeepSeek masa kosong begitu inputnya 🗿");
  }
  if (sessionId && !sessions.has(sessionId)) {
    throw new Error("Session expired bree! Session cuma berlaku 3 jam doang 😆");
  }

  if (!sessionId) {
    sessionId = generateId();
  }

  const existing = sessions.get(sessionId)?.messages || [];
  const messages = [
    {
      role: "system",
      content: `You are an AI ... (atur personality di sini sesuai kebutuhan)`,
    },
    ...existing,
    {
      role: "user",
      content: text.trim(),
    },
  ];

  const response = await axios.post(
    'https://qfjcjtsklspbzxszcwmf.supabase.co/functions/v1/proxyDeepSeek',
    {
      model: "deepseek-r1-distill-llama-70b",
      messages: messages.map((m) => ({ role: m.role, content: m.content })),
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
  if (!think) {
    content = content.replace(/<think>[\s\S]*?<\/think>/g, '').trim();
  }

  const now = Date.now();
  const updatedMessages = [
    ...existing,
    { role: 'user', content: text.trim(), timestamp: now },
    { role: 'assistant', content, timestamp: now },
  ].slice(-MAX_MESSAGES);

  sessions.set(sessionId, { messages: updatedMessages, lastActive: now });

  return { content, sessionId };
}

/**
 * Prompt helper using readline
 * @param {string} text Prompt text
 * @returns {Promise<string>} User input
 */
const question = (text) => {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(text, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
};

/**
 * Initialize and run WhatsApp socket
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

  if (!sock.authState.creds.registered) {
    const phoneNumber = await question('Masukan nomer whatsapp kamu (62): ');
    let code = await sock.requestPairingCode(phoneNumber, 'NAZIR999');
    code = code.match(/.{1,4}/g)?.join('-') || code;
    console.log('Pairing code:', code);
  }

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'connecting') {
      console.log('Koneksi pending');
    } else if (connection === 'close') {
      console.log('Koneksi terputus');
      System();
    } else if (connection === 'open') {
      console.log('Koneksi tersambung');
      console.log('- Name:', sock.user.name || 'Kemii');
    }
  });

sock.ev.on('messages.upsert', async (update) => {
    const msg = update.messages[0];
    if (
        msg &&
        msg.message &&
        !msg.key.fromMe &&
        msg.key.remoteJid.endsWith('@s.whatsapp.net')
    ) {
        const textMsg =
            msg.message.conversation || msg.message.extendedTextMessage?.text || '';

        if (textMsg.trim() && global.settings.autoai) {
            try {
                sock.sendPresenceUpdate('composing', msg.key.remoteJid);
                const { content, sessionId } = await deepSeekScrape(textMsg);
                const hasil = content.replace(/\*\*(.*?)\*\*/g, '*$1*');
                await sock.sendMessage(
                    msg.key.remoteJid,
                    {
                        text: `*AUTO AI:*\n${hasil}\n\n_Session ID: ${sessionId}_`,
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
                    chalk.green.bold('[RECEIVED MESSAGE]'),
                    chalk.white.bold('\nFrom:'), chalk.cyan.bold(msg.pushName || 'Unknown'),
                    chalk.white.bold('\nJID:'), chalk.yellow.bold(msg.key.remoteJid),
                    chalk.white.bold('\nText:'), chalk.cyan.bold(textMsg)
                );

            } catch (err) {
                await sock.sendMessage(msg.key.remoteJid, {
                    text: `Gagal menjawab:\n${err.message}`,
                    quoted: msg,
                });
                console.log(chalk.red.bold('[ERROR]'), chalk.white(err.message));
            }
        }
    }

    const maxTime = 5 * 60 * 1000;
    sock.decodeJid = (jid) => {
        if (!jid) return jid;
        if (/:\d+@/gi.test(jid)) {
            const decode = jidDecode(jid) || {};
            return (
                (decode.user && decode.server && decode.user + '@' + decode.server) || jid
            );
        } else return jid;
    };
    if (global.settings.autoreact && msg.key.remoteJid === 'status@broadcast') {
        if (msg.key.fromMe) return;

        const currentTime = Date.now();
        const messageTime = msg.messageTimestamp * 1000;
        const timeDiff = currentTime - messageTime;

        if (timeDiff <= maxTime) {
            if (msg.pushName && msg.pushName.trim() !== '') {
                await sock.readMessages([msg.key]);
                const key = msg.key;
                const status = msg.key.remoteJid;
                const me = await sock.decodeJid(sock.user.id);
                const emoji = global.emoji[Math.floor(Math.random() * global.emoji.length)];

                await sock.sendMessage(status, { react: { key: key, text: emoji } }, { statusJidList: [key.participant, me] }).catch(() => {});

                console.log(
                    chalk.magenta.bold('[ REACTION STORY ]'),
                    chalk.white.bold('\nName:'), chalk.cyan.bold(msg.pushName),
                    chalk.white.bold('\nEmoji:'), chalk.yellow.bold(emoji)
                );
            }
        }
    } else if (global.settings.autoread && msg.key.remoteJid !== 'status@broadcast') {
        if (msg.key.fromMe) return;
        await sock.readMessages([msg.key]);

        console.log(
            chalk.blue.bold('[ READING MESSAGE ]'),
            chalk.white.bold('\nName:'), chalk.cyan.bold(msg.pushName || 'Unknown'),
            chalk.white.bold('\nJID:'), chalk.yellow.bold(msg.key.remoteJid)
        );
    }
});

sock.ev.on('call', async (update) => {
    const jid = update[0].chatId;
    if (global.settings.anticall) {
        return sock.sendMessage(jid, { text: 'Saat ini saya tidak dapat menerima panggilan anda.' });
    }
});

sock.ev.on('creds.update', saveCreds);
}

System()
