const redis = require("../redis");

async function showProgress(ctx, uid) {
  const s = await redis.hgetall(`user:${uid}:stats`);
  const attempts = Number(s.attempts || "0");
  const correct = Number(s.correct || "0");
  const streak = Number(s.streak || "0");
  const acc = attempts ? Math.round((correct / attempts) * 100) : 0;
  const wrong = await redis.scard(`user:${uid}:wsrc/flows/progress.jsrong`);

  await ctx.reply(
    `📊 Progress\n` +
    `Attempts: ${attempts}\n` +
    `Correct: ${correct}\n` +
    `Accuracy: ${acc}%\n` +
    `Wrong to revise: ${wrong}\n` +
    `🔥 Streak: ${streak} day(s)`
  );
}

module.exports = { showProgress };
