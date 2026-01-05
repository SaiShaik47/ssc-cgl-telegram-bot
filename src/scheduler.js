const cron = require("node-cron");
const redis = require("./redis");

function startDailyScheduler(bot, studentId) {
  cron.schedule("* * * * *", async () => {
    try {
      const time = (await redis.get("daily:time")) || "07:30";
      const now = new Date();
      const cur = `${String(now.getHours()).padStart(2,"0")}:${String(now.getMinutes()).padStart(2,"0")}`;
      if (cur !== time) return;

      await bot.telegram.sendMessage(studentId, "⏰ Daily SSC CGL Time! Tap to start:", {
        reply_markup: {
          inline_keyboard: [
            [{ text: "✅ Start Daily Quiz (10)", callback_data: "daily_quiz" }],
            [{ text: "📊 Progress", callback_data: "show_progress" }]
          ]
        }
      });
    } catch (e) {
      console.error("Scheduler error:", e.message);
    }
  });
}

module.exports = { startDailyScheduler };
