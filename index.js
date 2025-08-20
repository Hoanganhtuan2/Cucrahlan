// === index.js ===
const express = require('express');
const TelegramBot = require('node-telegram-bot-api');

// ⚠️ Bạn có thể đổi thành biến môi trường BOT_TOKEN cho an toàn
const BOT_TOKEN = process.env.BOT_TOKEN || '8328121313:AAHV9V16SLf17VuT4PZza2lfG49hquIfM6U';

if (!BOT_TOKEN || BOT_TOKEN.length < 30) {
  console.error('❌ BOT_TOKEN thiếu hoặc không hợp lệ.');
  process.exit(1);
}

const app = express();
app.use(express.json());

// Khởi tạo bot (không dùng polling) để tự xử lý update qua webhook
const bot = new TelegramBot(BOT_TOKEN);

// URL public của service trên Render (Render tự cấp biến này)
const PUBLIC_URL = process.env.PUBLIC_URL || process.env.RENDER_EXTERNAL_URL; // ví dụ: https://my-bot.onrender.com
const PORT = process.env.PORT || 10000; // Render sẽ gán PORT tự động

// Tạo path webhook riêng với token để an toàn hơn
const WEBHOOK_PATH = `/webhook/${BOT_TOKEN.split(':')[0]}`; // ví dụ: /webhook/8328121313

// Endpoint kiểm tra nhanh
app.get('/', (_, res) => {
  res.send('✅ Telegram bot is running.');
});

// Endpoint nhận update từ Telegram
app.post(WEBHOOK_PATH, (req, res) => {
  bot.processUpdate(req.body);
  res.sendStatus(200);
});

// Logic bot đơn giản
bot.onText(/^\/start$/, (msg) => {
  const name = msg.from.first_name || 'bạn';
  bot.sendMessage(msg.chat.id, `Chào ${name}!\n\nMình là bot demo chạy trên Render.\nLệnh có sẵn:\n• /ping – kiểm tra bot sống\n• Gõ bất kỳ – bot sẽ echo lại (trừ lệnh).`);
});

bot.onText(/^\/ping$/, (msg) => {
  bot.sendMessage(msg.chat.id, '🏓 Pong! Bot đang chạy ổn.');
});

bot.on('message', (msg) => {
  // Bỏ qua nếu là lệnh
  if (msg.text && msg.text.startsWith('/')) return;
  if (msg.text) {
    bot.sendMessage(msg.chat.id, `Bạn vừa nói: \n> ${msg.text}`);
  }
});

async function bootstrap() {
  app.listen(PORT, async () => {
    console.log(`🚀 Server listening on :${PORT}`);
    if (!PUBLIC_URL) {
      console.warn('⚠️ PUBLIC_URL/RENDER_EXTERNAL_URL chưa có. Hãy đặt biến PUBLIC_URL = URL Render của bạn.');
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
}

bootstrap();

/*
=== Hướng dẫn Deploy Render (tóm tắt) ===
1) Push 2 file này lên GitHub (package.json, index.js).
2) Vào https://render.com → New → Web Service → chọn repo.
3) Build Command: npm install
   Start Command: npm start
4) Environment → Add:
   - BOT_TOKEN = 8328121313:AAHV9V16SLf17VuT4PZza2lfG49hquIfM6U (khuyên dùng biến môi trường thay vì hardcode)
   - (Tuỳ chọn) PUBLIC_URL = URL của service sau khi tạo, ví dụ https://ten-bot.onrender.com  
     *Render thường tự cấp RENDER_EXTERNAL_URL, nếu có thì không cần PUBLIC_URL*
5) Deploy. Khi service chạy, log sẽ in ra URL webhook. Gửi /start cho bot để test.
*/
