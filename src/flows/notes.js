const redis = require("../redis");

async function getNotes(ctx, topic) {
  if (!topic) return ctx.reply("Use: /notes <topic>\nExample: /notes percentage");
  const raw = await redis.get(`notes:${topic.toLowerCase()}`);
  if (!raw) return ctx.reply("No notes for this topic yet. Ask admin to add with /addnotes.");
  await ctx.reply(`📝 Notes: ${topic}\n\n${raw}`);
}

module.exports = { getNotes };
