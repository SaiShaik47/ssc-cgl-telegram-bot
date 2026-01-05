const redis = require("../redis");
const { parseTimeHHMM } = require("../utils");

// PDF upload flow
async function addPdf(ctx, name) {
  if (!name) return ctx.reply("Use: /addpdf <name> then send the PDF file.");
  await redis.set(`pdf:pending:${ctx.from.id}`, name.toLowerCase(), "EX", 300);
  await ctx.reply("✅ Okay! Now send the PDF file (as document) within 5 minutes.");
}

async function handlePdfUpload(ctx) {
  const pending = await redis.get(`pdf:pending:${ctx.from.id}`);
  if (!pending) return false;

  const doc = ctx.message.document;
  if (!doc || !doc.file_id) {
    await ctx.reply("Please send PDF as a document.");
    return true;
  }

  await redis.set(`pdf:${pending}`, doc.file_id);
  await redis.sadd("pdf:all", pending);
  await redis.del(`pdf:pending:${ctx.from.id}`);

  await ctx.reply(`✅ Saved PDF as "${pending}". Student can use: /pdf ${pending}`);
  return true;
}

// Single add question (manual)
async function addQuestion(ctx, textAfterCmd) {
  if (!textAfterCmd) {
    return ctx.reply(
      "Send like:\n" +
      "/addq\n" +
      "topic:math\n" +
      "q: 2+2?\n" +
      "a:3\nb:4\nc:5\nd:6\n" +
      "correct:B\n" +
      "explain: 2+2=4"
    );
  }

  const lines = textAfterCmd.split("\n").map(l => l.trim()).filter(Boolean);
  const obj = {};
  for (const line of lines) {
    const i = line.indexOf(":");
    if (i === -1) continue;
    obj[line.slice(0, i).toLowerCase()] = line.slice(i + 1).trim();
  }

  for (const k of ["q","a","b","c","d","correct"]) {
    if (!obj[k]) return ctx.reply(`Missing "${k}:"`);
  }

  const id = String(Date.now());
  const q = {
    id,
    topic: obj.topic || "general",
    q: obj.q,
    a: obj.a, b: obj.b, c: obj.c, d: obj.d,
    correct: obj.correct.toUpperCase(),
    explain: obj.explain || ""
  };

  await redis.set(`q:${id}`, JSON.stringify(q));
  await redis.rpush("qbank:all", id);
  await ctx.reply(`✅ Added question ${id} (topic: ${q.topic})`);
}

// Notes
async function addNotes(ctx, topic, notesText) {
  if (!topic || !notesText) return ctx.reply("Use: /addnotes <topic> <notes>");
  await redis.set(`notes:${topic.toLowerCase()}`, notesText);
  await ctx.reply(`✅ Notes saved for "${topic}"`);
}

// NEW: import questions from JSON file
// Admin uses: /importq  then sends a JSON file as document
async function importQuestionsAsk(ctx) {
  await redis.set(`importq:pending:${ctx.from.id}`, "1", "EX", 300);
  await ctx.reply(
    "✅ Now send a JSON file (as document) within 5 minutes.\n\n" +
    "JSON must be an array of questions:\n" +
    '[{"topic":"math","q":"...","a":"...","b":"...","c":"...","d":"...","correct":"B","explain":"..."}]'
  );
}

async function handleJsonImport(ctx) {
  const pending = await redis.get(`importq:pending:${ctx.from.id}`);
  if (!pending) return false;

  const doc = ctx.message.document;
  if (!doc) {
    await ctx.reply("Send the JSON as a document file.");
    return true;
  }

  // Fetch file from Telegram
  const fileLink = await ctx.telegram.getFileLink(doc.file_id);
  const res = await fetch(fileLink.href);
  if (!res.ok) {
    await ctx.reply("Failed to download JSON from Telegram.");
    return true;
  }

  let data;
  try {
    data = await res.json();
  } catch {
    await ctx.reply("JSON is not valid.");
    return true;
  }

  if (!Array.isArray(data)) {
    await ctx.reply("JSON must be an array of questions.");
    return true;
  }

  let added = 0;
  for (const item of data) {
    if (!item || typeof item !== "object") continue;
    const needed = ["q","a","b","c","d","correct"];
    if (needed.some(k => !item[k])) continue;

    const id = `${Date.now()}_${Math.floor(Math.random()*100000)}`;
    const q = {
      id,
      topic: item.topic || "general",
      q: String(item.q),
      a: String(item.a), b: String(item.b), c: String(item.c), d: String(item.d),
      correct: String(item.correct).toUpperCase(),
      explain: item.explain ? String(item.explain) : ""
    };

    await redis.set(`q:${id}`, JSON.stringify(q));
    await redis.rpush("qbank:all", id);
    added++;
  }

  await redis.del(`importq:pending:${ctx.from.id}`);
  await ctx.reply(`✅ Imported ${added} questions.`);
  return true;
}

// Broadcast
async function broadcast(ctx, telegram, studentId, msg) {
  if (!msg) return ctx.reply("Use: /broadcast <message>");
  await telegram.sendMessage(studentId, `📣 Admin:\n\n${msg}`);
  await ctx.reply("✅ Sent.");
}

// Daily reminder time
async function setDailyTime(ctx, hhmm) {
  const t = parseTimeHHMM(hhmm);
  if (!t) return ctx.reply("Use: /setdailytime HH:MM (24h)");
  const val = `${String(t.hh).padStart(2,"0")}:${String(t.mm).padStart(2,"0")}`;
  await redis.set("daily:time", val);
  await ctx.reply(`✅ Daily time set to ${val}`);
}

module.exports = {
  addPdf,
  handlePdfUpload,
  addQuestion,
  addNotes,
  importQuestionsAsk,
  handleJsonImport,
  broadcast,
  setDailyTime
};
