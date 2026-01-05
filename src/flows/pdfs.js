const redis = require("../redis");

// Student: /pdf -> list
// Student: /pdf name -> send
async function sendPdf(ctx, name) {
  if (!name) {
    const all = await redis.smembers("pdf:all");
    if (!all.length) return ctx.reply("No PDFs saved yet.");
    return ctx.reply(
      "📚 Available PDFs:\n" +
      all.map(x => `• ${x}`).join("\n") +
      "\n\nUse: /pdf <name>"
    );
  }

  const key = `pdf:${name.toLowerCase()}`;
  const fileId = await redis.get(key);
  if (!fileId) return ctx.reply("PDF not found. Use /pdf to list names.");
  await ctx.replyWithDocument(fileId);
}

module.exports = { sendPdf };
