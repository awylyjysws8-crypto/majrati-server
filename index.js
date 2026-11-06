const { Telegraf } = require('telegraf');
const express = require('express');
const admin = require('firebase-admin');

// 1. تهيئة Firebase باستخدام المتغيرات البيئية (لأننا في Render)
const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});
const db = admin.firestore();

// 2. تهيئة البوت
const bot = new Telegraf(process.env.BOT_TOKEN);

// 3. تهيئة السيرفر
const app = express();
app.use(express.json());

// عندما يرسل الطالب /start
bot.start(async (ctx) => {
  const telegramId = ctx.from.id;
  const code = "MAJ-" + Math.random().toString(36).substring(2, 8).toUpperCase();
  
  await db.collection('login_codes').doc(code).set({
    telegramId: telegramId,
    used: false,
    createdAt: admin.firestore.FieldValue.serverTimestamp()
  });

  ctx.reply(`أهلاً بك في مجرتي! 🎓\nكود الدخول الخاص بك هو:\n\n${code}\n\nأدخل هذا الكود في التطبيق لتبدأ رحلتك.`);
});

// نقطة الاتصال للتطبيق
app.post('/api/verify-code', async (req, res) => {
  const { code } = req.body;

  if (!code) return res.status(400).json({ error: "الرجاء إدخال الكود" });

  try {
    const docRef = db.collection('login_codes').doc(code);
    const doc = await docRef.get();

    if (!doc.exists) {
      return res.status(400).json({ error: "الكود غير صحيح" });
    }

    const data = doc.data();
    if (data.used) {
      return res.status(400).json({ error: "هذا الكود تم استخدامه مسبقاً" });
    }

    const customToken = await admin.auth().createCustomToken(data.telegramId.toString());
    await docRef.update({ used: true });

    res.json({ token: customToken });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "حدث خطأ في السيرفر" });
  }
});

// مسار افتراضي للتأكد من عمل السيرفر
app.get('/', (req, res) => res.send('Majrati Server is Running!'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
bot.launch();
