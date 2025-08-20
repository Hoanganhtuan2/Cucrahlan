const TelegramBot = require('node-telegram-bot-api');
const fs = require('fs');
const axios = require('axios');

// --- CONFIG ---
const token = '8328121313:AAHV9V16SLf17VuT4PZza2lfG49hquIfM6U';
const ADMIN_ID = 7853576129;
const NOTIFY_GROUP_ID = '-1002817772823';
const bot = new TelegramBot(token, { polling: true });

// --- CẤU HÌNH NẠP TIỀN ---
const ADMIN_BANK_NAME = 'MB Bank';
const ADMIN_BANK_ACCOUNT = '2916102009';
const ADMIN_BANK_OWNER = 'KSOR HUAN';

// --- LOAD COOKIE FROM key.txt ---
let TTC_COOKIE;
try {
    TTC_COOKIE = fs.readFileSync('key.txt', 'utf8').trim();
    if (!TTC_COOKIE) throw new Error('File key.txt is empty.');
} catch (error) {
    console.error("❌ ERROR: Unable to read cookie from key.txt. Please create key.txt and paste the cookie.");
    process.exit(1);
}

const TTC_USERNAME_NHAN = 'Vi_muabanxumxh';
const XU_TO_VND_RATE = 100;
const MIN_WITHDRAW_AMOUNT = 20000;
const MIN_TTC_SELL_AMOUNT = 10000;

// --- FILE PATHS ---
const NGUOIDUNG_FILE = './nguoidung.json';
const REF_FILE = './ref.json';
const LSALL_FILE = './lsall.json';
const CLAIMED_TTC_FILE = './claimed_ttc.json';

let userState = {};

// --- FILE READ/WRITE HELPERS ---
const readJSON = (filePath) => {
    try {
        if (!fs.existsSync(filePath)) {
            const defaultData = (filePath === NGUOIDUNG_FILE || filePath === CLAIMED_TTC_FILE) ? [] : {};
            fs.writeFileSync(filePath, JSON.stringify(defaultData, null, 2));
            return defaultData;
        }
        const data = fs.readFileSync(filePath, 'utf8');
        return data ? JSON.parse(data) : (filePath === NGUOIDUNG_FILE || filePath === CLAIMED_TTC_FILE) ? [] : {};
    } catch (error) {
        console.error(`Error reading file ${filePath}:`, error);
        return (filePath === NGUOIDUNG_FILE || filePath === CLAIMED_TTC_FILE) ? [] : {};
    }
};

const writeJSON = (filePath, data) => {
    try {
        fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
        console.error(`Error writing file ${filePath}:`, error);
    }
};

// --- ADMIN COMMANDS ---
bot.onText(/\/ct (.+) (.+)/, (msg, match) => {
    if (msg.from.id !== ADMIN_ID) return;
    const targetId = parseInt(match[1]);
    const amount = parseInt(match[2]);
    let data = readJSON(NGUOIDUNG_FILE);
    const userIndex = data.findIndex(u => u.id === targetId);
    if (userIndex === -1) return bot.sendMessage(msg.chat.id, `❌ User ID not found: ${targetId}`);
    data[userIndex].sodu += amount;
    writeJSON(NGUOIDUNG_FILE, data);
    bot.sendMessage(msg.chat.id, `✅ Added <b>${amount.toLocaleString('vi-VN')} đ</b> to user ID <code>${targetId}</code>.`, { parse_mode: 'HTML' });
    bot.sendMessage(targetId, `🎉 Admin added <b>${amount.toLocaleString('vi-VN')} đ</b> to your account.`, { parse_mode: 'HTML' }).catch(() => {});
});

bot.onText(/\/tt (.+) (.+)/, (msg, match) => {
    if (msg.from.id !== ADMIN_ID) return;
    const targetId = parseInt(match[1]);
    const amount = parseInt(match[2]);
    let data = readJSON(NGUOIDUNG_FILE);
    const userIndex = data.findIndex(u => u.id === targetId);
    if (userIndex === -1) return bot.sendMessage(msg.chat.id, `❌ User ID not found: ${targetId}`);
    data[userIndex].sodu -= amount;
    writeJSON(NGUOIDUNG_FILE, data);
    bot.sendMessage(msg.chat.id, `✅ Deducted <b>${amount.toLocaleString('vi-VN')} đ</b> from user ID <code>${targetId}</code>.`, { parse_mode: 'HTML' });
    bot.sendMessage(targetId, `❗️ Admin deducted <b>${amount.toLocaleString('vi-VN')} đ</b> from your account.`, { parse_mode: 'HTML' }).catch(() => {});
});

bot.onText(/\/kttk/, (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    const opts = {
        reply_markup: {
            inline_keyboard: [
                [
                    { text: '🔹 TDS', callback_data: 'check_tokens_tds' },
                    { text: '🔸 TTC', callback_data: 'check_tokens_ttc' }
                ]
            ]
        }
    };
    bot.sendMessage(msg.chat.id, '🔍 Chọn nền tảng để kiểm tra token:', opts);
});

// --- CALLBACK QUERY HANDLER ---
bot.on('callback_query', async (callbackQuery) => {
    const data = callbackQuery.data;
    const msg = callbackQuery.message;
    const userId = callbackQuery.from.id;
    const chatId = msg.chat.id;

    // --- TTC TOKEN CHECK ---
    if (data === 'check_tokens_ttc') {
        try {
            const tokens = fs.readFileSync('tokenttc.txt', 'utf8').split('\n').map(t => t.trim()).filter(Boolean);
            if (tokens.length === 0)
                return bot.editMessageText('⚠️ Không có token TTC nào trong file tokenttc.txt.', {
                    chat_id: chatId, message_id: msg.message_id
                });

            let result = '📋 <b>KẾT QUẢ TTC</b>\n\n';
            for (const token of tokens) {
                try {
                    const res = await axios.post('https://tuongtaccheo.com/logintoken.php', new URLSearchParams({
                        access_token: token
                    }).toString(), {
                        headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
                    });

                    if (res.data.status === 'success') {
                        const u = res.data.data;
                        result += `✅ <b>${u.user}</b>: <code>${parseInt(u.sodu).toLocaleString('vi-VN')} xu</code>\n`;
                    } else {
                        result += `❌ Token: ${token.slice(0, 6)}... lỗi\n`;
                    }
                } catch {
                    result += `❌ Token: ${token.slice(0, 6)}... lỗi kết nối\n`;
                }
            }

            bot.editMessageText(result, {
                chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML'
            });
        } catch (err) {
            bot.editMessageText('❌ Lỗi đọc file tokenttc.txt', {
                chat_id: chatId, message_id: msg.message_id
            });
        }
    }

    // --- TDS TOKEN CHECK ---
    if (data === 'check_tokens_tds') {
        try {
            const tokens = fs.readFileSync('tokentds.txt', 'utf8').split('\n').map(t => t.trim()).filter(Boolean);
            if (tokens.length === 0)
                return bot.editMessageText('⚠️ Không có token TDS nào trong file tokentds.txt.', {
                    chat_id: chatId, message_id: msg.message_id
                });

            let result = '📋 <b>KẾT QUẢ TDS</b>\n\n';
            for (const token of tokens) {
                try {
                    const res = await axios.get(`https://traodoisub.com/api/?fields=profile&access_token=${token}`);
                    const u = res.data.data;
                    if (res.data.success === 200 && u && u.user) {
                        result += `✅ <b>${u.user}</b>: <code>${parseInt(u.xu).toLocaleString('vi-VN')} xu</code>\n`;
                    } else {
                        result += `❌ Token: ${token.slice(0, 6)}... lỗi\n`;
                    }
                } catch {
                    result += `❌ Token: ${token.slice(0, 6)}... lỗi kết nối\n`;
                }
            }

            bot.editMessageText(result, {
                chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML'
            });
        } catch (err) {
            bot.editMessageText('❌ Lỗi đọc file tokentds.txt', {
                chat_id: chatId, message_id: msg.message_id
            });
        }
    }

    // --- DEPOSIT HANDLER ---
    if (data === 'deposit_bank') {
        const depositInfo = `
✅ <b>NẠP TIỀN VÀO TÀI KHOẢN</b>

Vui lòng chuyển khoản đến thông tin sau:
-----------------------------------
🏦 <b>Ngân hàng:</b> <code>${ADMIN_BANK_NAME}</code>
💳 <b>Số tài khoản:</b> <code>${ADMIN_BANK_ACCOUNT}</code>
👤 <b>Chủ tài khoản:</b> ${ADMIN_BANK_OWNER}
-----------------------------------
❗️ <b>Nội dung chuyển khoản BẮT BUỘC:</b>
<code>NAP ${userId}</code>
-----------------------------------
Sau khi chuyển khoản, vui lòng chờ admin xác nhận và cộng tiền thủ công.`;
        await bot.editMessageText(depositInfo, {
            chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: 'OK', callback_data: 'close_message' }]] }
        }).catch(err => console.log(err.message));
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    if (data === 'close_message') {
        try {
            await bot.deleteMessage(chatId, msg.message_id);
        } catch (error) {
            console.error(`Error deleting message: ${error.message}`);
        }
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    // --- Deposit/Withdraw Choice Handlers ---
    if (data === 'deposit') {
        await bot.editMessageText('Bạn đã chọn <b>Nạp tiền</b>. Vui lòng chọn phương thức:', {
            chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '🏦 Ngân Hàng', callback_data: 'deposit_bank' }]] }
        });
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    if (data === 'withdraw') {
        await bot.editMessageText('Bạn đã chọn <b>Rút tiền</b>. Vui lòng chọn phương thức:', {
            chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '🏦 Ngân Hàng', callback_data: 'withdraw_bank' }]] }
        });
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    if (data === 'withdraw_bank') {
        try {
            await bot.deleteMessage(chatId, msg.message_id);
        } catch (error) {
            console.error(`Error deleting message: ${error.message}`);
        }
        handleRutBank(chatId, userId);
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    // --- BANK SELECTION FOR WITHDRAWAL ---
    if (data.startsWith('chonbank_')) {
        const code = data.split('_')[1];
        const banks = await getBanks();
        const bank = banks.find(b => b.code === code);
        if (!bank) { return bot.answerCallbackQuery(callbackQuery.id, { text: 'Ngân hàng không tồn tại' }); }

        userState[userId] = {
            action: 'awaiting_stk',
            bankCode: bank.code,
            bankName: bank.name,
            bankShortName: bank.shortName,
            logo: bank.logo
        };

        try {
            await bot.deleteMessage(chatId, msg.message_id);
        } catch (error) {
            console.error(`Error deleting message: ${error.message}`);
        }
        await bot.sendPhoto(chatId, bank.logo, {
            caption: `🏦 <b>Ngân hàng: ${bank.name}</b>\n\n➡️ Vui lòng nhập <b>Số Tài Khoản (STK)</b> của bạn:`,
            parse_mode: 'HTML'
        });
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    // --- ADMIN CONFIRMS WITHDRAWAL ---
    if (data.startsWith('admin_xacnhanrut_')) {
        const parts = data.split('_');
        const targetUserId = parseInt(parts[2], 10);
        const sotien = parseInt(parts[3], 10);
        const bankCode = parts[4];
        const stk = parts[5];

        if (isNaN(targetUserId) || isNaN(sotien)) {
            bot.answerCallbackQuery(callbackQuery.id, { text: '❌ Lỗi: Dữ liệu giao dịch không hợp lệ.', show_alert: true });
            return bot.editMessageCaption('❌ LỖI DỮ LIỆU GIAO DỊCH\nKhông thể xử lý do sai định dạng. Vui lòng kiểm tra lại.', {
                chat_id: msg.chat.id, message_id: msg.message_id
            });
        }

        const banks = await getBanks();
        const bank = banks.find(b => b.code === bankCode);
        const bankShortName = bank ? bank.shortName : bankCode;

        await bot.answerCallbackQuery(callbackQuery.id, { text: '✅ Đã xác nhận. Đang gửi thông báo...' });

        bot.sendMessage(targetUserId, `🎉 <b>Rút tiền thành công</b>\n\nBạn đã rút thành công <b>${sotien.toLocaleString('vi-VN')}đ</b> về tài khoản <b>${stk} (${bankShortName})</b>. ✅`, { parse_mode: 'HTML' }).catch(err => console.error("Error notifying user:", err.message));
        bot.sendMessage(NOTIFY_GROUP_ID, `Người Dùng: <code>${targetUserId}</code>\nRút Thành Công ${sotien.toLocaleString('vi-VN')}đ ✅`, { parse_mode: 'HTML' }).catch(err => console.error("Error notifying group:", err.message));

        let lsData = readJSON(LSALL_FILE);
        const time = new Date();
        const formattedDate = `${time.getDate()}/${time.getMonth() + 1}/${time.getFullYear()}`;
        const lsEntry = `Rút ${sotien.toLocaleString('vi-VN')}đ về STK ${stk} (${bankShortName}) ngày ${formattedDate} Thành Công ✅`;
        if (!lsData[targetUserId]) lsData[targetUserId] = { ls_rut: [], ls_nap: [], ls_mua_xu: [], ls_ban_xu: [] };
        if (!lsData[targetUserId].ls_rut) lsData[targetUserId].ls_rut = [];
        lsData[targetUserId].ls_rut.push(lsEntry);
        writeJSON(LSALL_FILE, lsData);

        return bot.editMessageCaption(`✅ <b>ĐÃ XỬ LÝ RÚT TIỀN</b>\n\n👤 ID: <code>${targetUserId}</code>\n🏦 Ngân hàng: ${bankShortName}\n🔢 STK: <code>${stk}</code>\n💰 Số tiền: <code>${sotien.toLocaleString('vi-VN')}đ</code>`, {
            chat_id: msg.chat.id, message_id: msg.message_id, parse_mode: 'HTML'
        });
    }

    // --- BUY/SELL HANDLERS ---
    if (data === 'buy' || data === 'sell') {
        const tradeType = (data === 'buy') ? 'Mua' : 'Bán';
        bot.editMessageText(`Bạn đã chọn <b>${tradeType}</b>. Vui lòng chọn loại giao dịch:`, {
            chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: 'TDS', callback_data: `${data}_tds` }, { text: 'TTC', callback_data: `${data}_ttc` }]] }
        });
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    // --- TTC SELL HANDLER ---
    if (data === 'sell_ttc') {
        userState[userId] = { action: 'sell_ttc', step: 'awaiting_username' };
        bot.sendMessage(chatId, "➡️ Vui lòng nhập <b>Tên tài khoản Tương Tác Chéo của bạn</b>:", { parse_mode: 'HTML' });
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    if (data.startsWith('confirm_sell_ttc_')) {
        await bot.answerCallbackQuery(callbackQuery.id, { text: '🔍 Đang kiểm tra giao dịch...' });
        const parts = data.split('_');
        const usertang = parts[3];
        const soluong = parseInt(parts[4]);

        const url = 'https://tuongtaccheo.com/caidat/lichsutangxu.php';
        const headers = { 'Accept': '*/*', 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8', 'Origin': 'https://tuongtaccheo.com', 'Referer': 'https://tuongtaccheo.com/caidat/', 'User-Agent': 'Mozilla/5.0', 'X-Requested-With': 'XMLHttpRequest', 'Cookie': TTC_COOKIE };
        const startTime = new Date(new Date().getTime() - 4 * 60 * 60 * 1000);
        const endTime = new Date();
        const formatDateTime = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
        const params = new URLSearchParams({ start: formatDateTime(startTime), end: formatDateTime(endTime), loaihd: 'nhan' });

        try {
            const response = await axios.post(url, params.toString(), { headers });

            if (typeof response.data === 'number' || !Array.isArray(response.data)) {
                await bot.editMessageText(`❌ <b>Lỗi Xác Thực</b>\n\nCookie trong file <b>key.txt</b> đã hết hạn hoặc không hợp lệ. Vui lòng cập nhật lại cookie và khởi động lại bot.`, { chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML' });
                return;
            }

            const claimedTxs = readJSON(CLAIMED_TTC_FILE);
            const validTx = response.data.find(tx => tx.usertang.toLowerCase() === usertang.toLowerCase() && parseInt(tx.soluong) === soluong && tx.usernhan.toLowerCase() === TTC_USERNAME_NHAN.toLowerCase() && tx.loai === 'XU' && !claimedTxs.includes(tx.thoigian));

            if (validTx) {
                const soduThem = Math.floor(soluong / XU_TO_VND_RATE);
                let allUsers = readJSON(NGUOIDUNG_FILE);
                let userIdx = allUsers.findIndex(u => u.id === userId);

                if (userIdx !== -1) {
                    allUsers[userIdx].sodu += soduThem;
                    allUsers[userIdx].tongxuban += soluong;
                    writeJSON(NGUOIDUNG_FILE, allUsers);

                    let lsData = readJSON(LSALL_FILE);
                    const time = new Date();
                    const formattedDate = `${time.getDate()}/${time.getMonth() + 1}/${time.getFullYear()}`;
                    const lsEntry = `${usertang} TTC: +${soduThem.toLocaleString('vi-VN')}đ ngày ${formattedDate} Thành Công ✅`;
                    if (!lsData[userId]) lsData[userId] = { ls_rut: [], ls_nap: [], ls_mua_xu: [], ls_ban_xu: [] };
                    lsData[userId].ls_ban_xu.push(lsEntry);
                    writeJSON(LSALL_FILE, lsData);

                    claimedTxs.push(validTx.thoigian);
                    writeJSON(CLAIMED_TTC_FILE, claimedTxs);

                    const notifyMessage = `
🎉 <b>GIAO DỊCH BÁN XU MỚI</b> 🎉
-----------------------------------
👤 <b>Người dùng ID:</b> <code>${userId}</code>
👨‍💻 <b>Tài khoản TTC:</b> <code>${usertang}</code>
💰 <b>Số lượng bán:</b> ${soluong.toLocaleString('vi-VN')} xu
💵 <b>Tiền nhận được:</b> +${soduThem.toLocaleString('vi-VN')} đ
✅ <b>Trạng thái:</b> Thành Công
                    `;
                    bot.sendMessage(NOTIFY_GROUP_ID, notifyMessage, { parse_mode: 'HTML' })
                        .catch(err => console.error("Lỗi gửi tin nhắn đến nhóm:", err.message));

                    await bot.editMessageText(
                        `<b>GIAO DỊCH THÀNH CÔNG</b> ✅\n\n` +
                        `Nội dung: <b>Bán ${soluong.toLocaleString('vi-VN')} xu TTC</b>\n` +
                        `Nhận được: <b>+${soduThem.toLocaleString('vi-VN')} đ</b>\n` +
                        `Thời gian: <b>${time.toLocaleString('vi-VN')}</b>`,
                        { chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML' }
                    );
                }
            } else {
                await bot.editMessageText(`❌ <b>KHÔNG TÌM THẤY GIAO DỊCH</b>\n\nVui lòng kiểm tra lại:\n- Bạn đã chuyển xu <b>TRƯỚC KHI</b> bấm nút.\n- Chuyển đúng <b>số xu</b> và đúng <b>người nhận</b>.\n- Giao dịch này chưa được xác nhận trước đây.`, { chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML' });
            }
        } catch (error) {
            console.error("Lỗi API:", error.message);
            await bot.editMessageText('❌ Đã có lỗi khi kết nối tới hệ thống Tương Tác Chéo.', { chat_id: chatId, message_id: msg.message_id });
        }
        return;
    }

    // --- HISTORY HANDLERS ---
    if (data.startsWith('ls_')) {
        const lsallData = readJSON(LSALL_FILE);
        const userHistory = lsallData[userId] || {};
        let historyType = '', historyList = [];
        switch (data) {
            case 'ls_rut': historyType = 'Rút Tiền'; historyList = userHistory.ls_rut || []; break;
            case 'ls_nap': historyType = 'Nạp Tiền'; historyList = userHistory.ls_nap || []; break;
            case 'ls_mua_xu': historyType = 'Mua Xu'; historyList = userHistory.ls_mua_xu || []; break;
            case 'ls_ban_xu': historyType = 'Bán Xu'; historyList = userHistory.ls_ban_xu || []; break;
        }
        let historyMessage = `<b>Lịch sử ${historyType}</b>\n\n` + (historyList.length > 0 ? historyList.map(item => `• ${item}`).join('\n') : 'Chưa có giao dịch nào.');
        bot.editMessageText(historyMessage, {
            chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: '⬅️ Quay lại', callback_data: 'back_to_account' }]] }
        });
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    if (data === 'back_to_account') {
        const nguoidungData = readJSON(NGUOIDUNG_FILE);
        const user = nguoidungData.find(u => u.id === userId);
        if (!user) return bot.answerCallbackQuery(callbackQuery.id);
        const accountInfo = `<b>--- TÀI KHOẢN ---</b>\n🆔 <b>ID:</b> <code>${user.id}</code>\n💰 <b>Số dư:</b> <code>${user.sodu.toLocaleString('vi-VN')} đ</code>\n🌹 <b>Tổng hoa hồng:</b> <code>${user.tonghoahong.toLocaleString('vi-VN')} đ</code>`;
        bot.editMessageText(accountInfo, {
            chat_id: chatId, message_id: msg.message_id, parse_mode: 'HTML',
            reply_markup: { inline_keyboard: [[{ text: 'LS Rút Tiền', callback_data: 'ls_rut' }, { text: 'LS Nạp Tiền', callback_data: 'ls_nap' }], [{ text: 'LS Mua Xu', callback_data: 'ls_mua_xu' }, { text: 'LS Bán Xu', callback_data: 'ls_ban_xu' }]] }
        });
        return bot.answerCallbackQuery(callbackQuery.id);
    }

    await bot.answerCallbackQuery(callbackQuery.id).catch(() => {});
});

// --- START COMMAND ---
bot.onText(/\/start/, (msg) => {
    const userId = msg.from.id;
    let nguoidungData = readJSON(NGUOIDUNG_FILE);
    if (!nguoidungData.find(u => u.id === userId)) {
        if (!Array.isArray(nguoidungData)) nguoidungData = [];
        nguoidungData.push({ id: userId, sodu: 0, tongxuban: 0, tongxumua: 0, tongnap: 0, tongrut: 0, tonghoahong: 0 });
        writeJSON(NGUOIDUNG_FILE, nguoidungData);
    }
    bot.getMe().then((botInfo) => {
        const welcomeMessage = `👋 Chào Mừng Bạn Đến Với @${botInfo.username}\n🆔 ID của bạn: <code>${userId}</code>`;
        bot.sendMessage(msg.chat.id, welcomeMessage, {
            reply_markup: { keyboard: [[{ text: '👤 Tài khoản' }, { text: '🔄 Mua Bán' }], [{ text: '💳 Nạp Rút' }, { text: '🤝 Mời Bạn' }]], resize_keyboard: true },
            parse_mode: 'HTML'
        });
    });
});

// --- THONGKE COMMAND ---
bot.onText(/\/thongke/, (msg) => {
    if (msg.from.id !== ADMIN_ID) return;
    const data = readJSON(NGUOIDUNG_FILE);
    const totalUsers = data.length;
    const totalSodu = data.reduce((sum, user) => sum + user.sodu, 0);
    const statsMessage = `📊 <b>THỐNG KÊ HỆ THỐNG</b>\n-------------------\n👥 <b>Tổng người dùng:</b> ${totalUsers}\n💰 <b>Tổng số dư:</b> ${totalSodu.toLocaleString('vi-VN')} đ`;
    bot.sendMessage(msg.chat.id, statsMessage, { parse_mode: 'HTML' });
});

// --- MAIN MESSAGE HANDLER ---
bot.on('message', async (msg) => {
    const chatId = msg.chat.id;
    const userId = msg.from.id;
    const text = msg.text;

    if (!text || text.startsWith('/')) return;

    const state = userState[userId];

    // --- Multi-step Bank Withdraw Process ---
    if (state && state.action === 'awaiting_stk') {
        const stk = text.trim();
        if (!/^\d+$/.test(stk)) { return bot.sendMessage(chatId, "❌ Số tài khoản không hợp lệ. Vui lòng chỉ nhập số."); }
        state.stk = stk;
        state.action = 'awaiting_amount';
        bot.sendMessage(chatId, `✅ Đã ghi nhận STK: <b>${stk}</b>\n\n➡️ Vui lòng nhập <b>số tiền</b> bạn muốn rút (Tối thiểu: ${MIN_WITHDRAW_AMOUNT.toLocaleString('vi-VN')}đ):`, { parse_mode: 'HTML' });
        return;
    }

    if (state && state.action === 'awaiting_amount') {
        const amount = parseInt(text.trim(), 10);
        if (isNaN(amount) || amount < MIN_WITHDRAW_AMOUNT) {
            return bot.sendMessage(chatId, `❌ Số tiền không hợp lệ hoặc dưới mức tối thiểu <b>${MIN_WITHDRAW_AMOUNT.toLocaleString('vi-VN')}đ</b>. Vui lòng nhập lại.`, { parse_mode: 'HTML' });
        }

        const nguoidungData = readJSON(NGUOIDUNG_FILE);
        const user = nguoidungData.find(u => u.id === userId);
        if (!user || user.sodu < amount) {
            delete userState[userId];
            return bot.sendMessage(chatId, '❌ Số dư của bạn không đủ để thực hiện giao dịch này.');
        }

        user.sodu -= amount;
        writeJSON(NGUOIDUNG_FILE, nguoidungData);

        const callbackData = `admin_xacnhanrut_${userId}_${amount}_${state.bankCode}_${state.stk}`;
        const qrUrl = `https://img.vietqr.io/image/${state.bankCode}-${state.stk}-compact.jpg?amount=${amount}&addInfo=Rut tien cho ${userId}`;
        const adminMsg = `<b>📤 YÊU CẦU RÚT TIỀN MỚI</b>\n\n` +
                        `👤 <b>ID Người dùng:</b> <code>${userId}</code>\n` +
                        `🏦 <b>Ngân hàng:</b> ${state.bankName}\n` +
                        `🔢 <b>STK:</b> <code>${state.stk}</code>\n` +
                        `💰 <b>Số tiền:</b> <code>${amount.toLocaleString('vi-VN')} đ</code>`;

        const confirmBtn = {
            reply_markup: { inline_keyboard: [[{ text: '✅ Đã chuyển', callback_data: callbackData }]] }
        };

        try {
            await bot.sendPhoto(ADMIN_ID, qrUrl, { caption: adminMsg, parse_mode: 'HTML', ...confirmBtn });
        } catch (error) {
            console.error("Error sending QR to admin:", error.message);
            await bot.sendMessage(ADMIN_ID, adminMsg, { parse_mode: 'HTML', ...confirmBtn });
        }
        bot.sendMessage(chatId, '✅ Đã gửi yêu cầu rút tiền của bạn đến Admin. Giao dịch sẽ được xử lý trong thời gian sớm nhất.');

        delete userState[userId];
        return;
    }

    // --- TTC SELL PROCESS ---
    if (state && state.action === 'sell_ttc') {
        if (state.step === 'awaiting_username') {
            userState[userId].ttcUsername = text.trim();
            userState[userId].step = 'awaiting_amount';
            bot.sendMessage(chatId, `✅ Đã ghi nhận tên tài khoản.\n\n➡️ Vui lòng nhập <b>số xu</b> bạn muốn bán (Tối thiểu: ${MIN_TTC_SELL_AMOUNT.toLocaleString('vi-VN')} xu):`, { parse_mode: 'HTML' });
            return;
        }
        if (state.step === 'awaiting_amount') {
            const amount = parseInt(text.trim(), 10);
            if (isNaN(amount) || amount < MIN_TTC_SELL_AMOUNT) {
                bot.sendMessage(chatId, `❌ Số xu không hợp lệ. Vui lòng nhập số xu tối thiểu ${MIN_TTC_SELL_AMOUNT.toLocaleString('vi-VN')}.`, { parse_mode: 'HTML' });
                return;
            }
            const ttcUsername = userState[userId].ttcUsername;
            const soduNhanDuoc = Math.floor(amount / XU_TO_VND_RATE);
            const confirmationMessage = `<b>--- XÁC NHẬN BÁN XU ---</b>\n\n- <b>Tài khoản TTC nhận:</b> <code>${TTC_USERNAME_NHAN}</code>\n- <b>Số xu bạn bán:</b> <code>${amount.toLocaleString('vi-VN')}</code>\n- <b>Số dư bạn sẽ nhận:</b> <code>${soduNhanDuoc.toLocaleString('vi-VN')} đ</code>\n\n⚠️ <b>QUAN TRỌNG:</b> Hãy chắc chắn bạn đã chuyển <b>${amount.toLocaleString('vi-VN')} xu</b> từ tài khoản <b>${ttcUsername}</b> đến tài khoản <b>${TTC_USERNAME_NHAN}</b> của chúng tôi. Sau khi chuyển, hãy bấm nút "<b>Xác Nhận Đã Chuyển</b>".`;
            bot.sendMessage(chatId, confirmationMessage, {
                reply_markup: { inline_keyboard: [[{ text: '✅ Xác Nhận Đã Chuyển', callback_data: `confirm_sell_ttc_${ttcUsername}_${amount}` }]] },
                parse_mode: 'HTML'
            });
            delete userState[userId];
            return;
        }
    }

    const nguoidungData = readJSON(NGUOIDUNG_FILE);
    const user = nguoidungData.find(u => u.id === userId);
    if (!user) return bot.sendMessage(chatId, "Vui lòng bấm /start để bắt đầu.");

    switch (text) {
        case '👤 Tài khoản':
            const accountInfo = `<b>--- TÀI KHOẢN ---</b>\n🆔 <b>ID:</b> <code>${user.id}</code>\n💰 <b>Số dư:</b> <code>${user.sodu.toLocaleString('vi-VN')} đ</code>\n🌹 <b>Tổng hoa hồng:</b> <code>${user.tonghoahong.toLocaleString('vi-VN')} đ</code>`;
            bot.sendMessage(chatId, accountInfo, {
                reply_markup: { inline_keyboard: [[{ text: 'LS Rút Tiền', callback_data: 'ls_rut' }, { text: 'LS Nạp Tiền', callback_data: 'ls_nap' }], [{ text: 'LS Mua Xu', callback_data: 'ls_mua_xu' }, { text: 'LS Bán Xu', callback_data: 'ls_ban_xu' }]] },
                parse_mode: 'HTML'
            });
            break;
        case '🔄 Mua Bán':
            bot.sendMessage(chatId, 'Chọn hình thức giao dịch:', { reply_markup: { inline_keyboard: [[{ text: '♥️ Mua', callback_data: 'buy' }, { text: '🧩 Bán', callback_data: 'sell' }]] } });
            break;
        case '💳 Nạp Rút':
            bot.sendMessage(chatId, 'Chọn giao dịch:', { reply_markup: { inline_keyboard: [[{ text: '💸 Nạp tiền', callback_data: 'deposit' }, { text: '💸 Rút tiền', callback_data: 'withdraw' }]] } });
            break;
        case '🤝 Mời Bạn':
            bot.getMe().then((botInfo) => {
                const referralLink = `https://t.me/${botInfo.username}?start=${userId}`;
                const refData = readJSON(REF_FILE);
                const referredCount = refData[userId] ? refData[userId].length : 0;
                const referralMessage = `<b>--- MỜI BẠN BÈ ---</b>\n\n🔗 <b>Link giới thiệu:</b>\n<code>${referralLink}</code>\n\n📈 Bạn đã mời được: <b>${referredCount}</b> người.`;
                bot.sendMessage(chatId, referralMessage, { parse_mode: 'HTML' });
            });
            break;
    }
});

// --- HELPER FUNCTIONS ---
const getBanks = async () => {
    try {
        const res = await axios.get('https://api.vietqr.io/v2/banks');
        return res.data.data || [];
    } catch (err) {
        console.error('❌ Unable to fetch bank list:', err.message);
        return [];
    }
};

const handleRutBank = async (chatId, userId) => {
    let banks = await getBanks();
    if (banks.length === 0) {
        return bot.sendMessage(chatId, '⚠️ Hệ thống không thể lấy danh sách ngân hàng vào lúc này. Vui lòng thử lại sau.');
    }

    banks = banks.slice(0, 15);

    const buttons = [];
    let row = [];
    for (const bank of banks) {
        row.push({ text: bank.shortName, callback_data: `chonbank_${bank.code}` });
        if (row.length === 3) {
            buttons.push(row);
            row = [];
        }
    }
    if (row.length > 0) { buttons.push(row); }

    userState[userId] = { action: 'rut_bank_step1' };
    bot.sendMessage(chatId, '🏦 Vui lòng chọn ngân hàng bạn muốn rút tiền về:', {
        reply_markup: { inline_keyboard: buttons }
    });
};

bot.onText(/\/rutbank/, (msg) => { handleRutBank(msg.chat.id, msg.from.id); });

bot.on('polling_error', (error) => console.log(`Polling Error: ${error.code} - ${error.message}`));

console.log('✅ Bot started - All features fixed and restored.');
