const config = require("./config");

if (!config.isValid) {
  console.error(
    `⚠️ Bot not started. Missing env vars: ${config.missing.join(", ")}. ` +
      "Add them in Railway Variables and redeploy."
  );
  setInterval(() => {}, 60 * 60 * 1000);
  return;
}

const { BOT_TOKEN, ADMIN_ID, STUDENT_ID } = config;
const { Telegraf } = require("telegraf");
const redis = require("./redis");
const { gate, isAdmin } = require("./auth");

const { startQuiz, handleAnswer } = require("./flows/quiz");
const { showProgress } = require("./flows/progress");
const { getNotes } = require("./flows/notes");
const { sendPdf } = require("./flows/pdfs");
const admin = require("./flows/admin");

const { startDailyScheduler } = require("./scheduler");

const bot = new Telegraf(BOT_TOKEN);

bot.start(async (ctx) => {
  const g = gate(ctx);
  const uid = ctx.from?.id;

  await ctx.reply(`Hi ${ctx.from.first_name} 👋\nYour Telegram ID: ${uid}`);

  if (!g.ok) return ctx.reply("❌ This bot is private.");

  if (uid === ADMIN_ID) {
    return ctx.reply(
      "✅ Admin commands:\n" +
        "/addpdf <name>\n" +
        "/addq (multi-line)\n" +
        "/importq (upload JSON file)\n" +
        "/addnotes <topic> <notes>\n" +
        "/broadcast <message>\n" +
        "/setdailytime HH:MM\n\n" +
        "Student:\n/daily /quiz /mock /notes /pdf /progress"
    );
  }

  return ctx.reply(
    "📚 SSC CGL Prep Bot\n\nCommands:\n" +
      "/daily\n" +
      "/quiz (10)\n" +
      "/quiz <topic>\n" +
      "/mock (25)\n" +
      "/notes <topic>\n" +
      "/pdf (list)\n" +
      "/pdf <name>\n" +
      "/progress\n\n" +
      "Or tap button when daily reminder comes ✅"
  );
});

// Student commands
bot.command("daily", async (ctx) => {
  const g = gate(ctx);
  if (!g.ok || g.role !== "student") return;

  await ctx.reply(
    "✅ Today plan:\n" +
      "1) Quant 20 min\n" +
      "2) English 20 min\n" +
      "3) Reasoning 15 min\n" +
      "4) GK 10 min\n\n" +
      "Tap below to start quiz:",
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: "✅ Start Daily Quiz (10)", callback_data: "daily_quiz" }]
        ]
      }
    }
  );
});

bot.command("quiz", async (ctx) => {
  const g = gate(ctx);
  if (!g.ok || g.role !== "student") return;
  const topic = ctx.message.text.split(" ").slice(1).join(" ").trim() || null;
  await startQuiz(ctx, ctx.from.id, 10, topic);
});

bot.command("mock", async (ctx) => {
  const g = gate(ctx);
  if (!g.ok || g.role !== "student") return;
  await startQuiz(ctx, ctx.from.id, 25, null);
});

bot.command("notes", async (ctx) => {
  const g = gate(ctx);
  if (!g.ok || g.role !== "student") return;
  const topic = ctx.message.text.split(" ").slice(1).join(" ").trim();
  await getNotes(ctx, topic);
});

bot.command("pdf", async (ctx) => {
  const g = gate(ctx);
  if (!g.ok || g.role !== "student") return;
  const name = ctx.message.text.split(" ").slice(1).join(" ").trim();
  await sendPdf(ctx, name);
});

bot.command("progress", async (ctx) => {
  const g = gate(ctx);
  if (!g.ok || g.role !== "student") return;
  await showProgress(ctx, ctx.from.id);
});

// ✅ One-click buttons
bot.action("daily_quiz", async (ctx) => {
  try {
    const g = gate(ctx);
    if (!g.ok || g.role !== "student") return;
    await ctx.answerCbQuery("Starting quiz...");
    await startQuiz(ctx, ctx.from.id, 10, null);
  } catch (e) {
    console.error(e);
  }
});

bot.action("show_progress", async (ctx) => {
  try {
    const g = gate(ctx);
    if (!g.ok || g.role !== "student") return;
    await ctx.answerCbQuery("Showing progress...");
    await showProgress(ctx, ctx.from.id);
  } catch (e) {
    console.error(e);
  }
});

// Admin commands
bot.command("addpdf", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const name = ctx.message.text.split(" ").slice(1).join(" ").trim();
  await admin.addPdf(ctx, name);
});

bot.command("addq", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const text = ctx.message.text.split("\n").slice(1).join("\n").trim();
  await admin.addQuestion(ctx, text);
});

bot.command("importq", async (ctx) => {
  if (!isAdmin(ctx)) return;
  await admin.importQuestionsAsk(ctx);
});

bot.command("addnotes", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const args = ctx.message.text.split(" ").slice(1);
  const topic = args.shift();
  const notesText = args.join(" ").trim();
  await admin.addNotes(ctx, topic, notesText);
});

bot.command("broadcast", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const msg = ctx.message.text.split(" ").slice(1).join(" ").trim();
  await admin.broadcast(ctx, bot.telegram, STUDENT_ID, msg);
});

bot.command("setdailytime", async (ctx) => {
  if (!isAdmin(ctx)) return;
  const hhmm = ctx.message.text.split(" ").slice(1).join(" ").trim();
  await admin.setDailyTime(ctx, hhmm);
});

// Upload handlers (PDF + JSON)
bot.on("document", async (ctx) => {
  if (!isAdmin(ctx)) return;

  // 1) Try PDF save flow
  const pdfHandled = await admin.handlePdfUpload(ctx);
  if (pdfHandled) return;

  // 2) Try JSON import flow
  const jsonHandled = await admin.handleJsonImport(ctx);
  if (jsonHandled) return;

  await ctx.reply("Use /addpdf <name> for PDF or /importq for JSON questions first.");
});

// Student answers
bot.on("text", async (ctx) => {
  const g = gate(ctx);
  if (!g.ok || g.role !== "student") return;
  await handleAnswer(ctx, ctx.from.id, ctx.message.text);
});

// Start daily scheduler
startDailyScheduler(bot, STUDENT_ID);

bot.launch()
  .then(() => console.log("Bot running ✅"))
  .catch((e) => console.error("Launch error:", e));

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));
