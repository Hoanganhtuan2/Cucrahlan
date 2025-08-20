const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// Lấy token từ biến môi trường (Render -> Environment)
const BOT_TOKEN = process.env.BOT_TOKEN || '8328121313:AAHV9V16SLf17VuT4PZza2lfG49hquIfM6U';

if (!BOT_TOKEN || BOT_TOKEN.length < 30) {
  console.error('❌ BOT_TOKEN thiếu hoặc không hợp lệ.');
  process.exit(1);
}

const app = express();
app.use(express.json());

const bot = new TelegramBot(BOT_TOKEN);

// Render tự cấp URL qua biến RENDER_EXTERNAL_URL
const PUBLIC_URL = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL;
const PORT = process.env.PORT || 10000;

const WEBHOOK_PATH = `/webhook/${BOT_TOKEN.split(':')[0]}`;

app.get('/', (_, res) => {
  res.send('✅ Telegram bot is running.');
});

app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

bot.onText(/^\/start$/, (msg) => {
  const name = msg.from.first_name || 'bạn';
  bot.sendMessage(msg.chat.id, `Chào ${name}! 👋\nMình là bot demo chạy trên Render.`);
});

bot.onText(/^\/ping$/, (msg) => {
  bot.sendMessage(msg.chat.id, '🏓 Pong! Bot đang chạy ổn.');
});

bot.on('message', (msg) => {
  if (msg.text && msg.text.startsWith('/')) return;
  if (msg.text) bot.sendMessage(msg.chat.id, `Bạn vừa nói:\n> ${msg.text}`);
});

app.listen(PORT, async () => {
  console.log(`🚀 Server listening on :${PORT}`);
  if (!PUBLIC_URL) {
    console.warn('⚠️ PUBLIC_URL chưa có, đợi Render cấp RENDER_EXTERNAL_URL...');
    return;
  }
  const webhookUrl = `${PUBLIC_URL}${WEBHOOK_PATH}`;
  try {
    await bot.setWebHook(webhookUrl);
    console.log('✅ Webhook set:', webhookUrl);
  } catch (e) {
    console.error('❌ Set webhook thất bại:', e.message);
  }
});
