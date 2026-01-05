const redis = require("../redis");
const { todayKey } = require("../utils");

function formatQ(q, n, total) {
  return `Q${n}/${total}\n\n${q.q}\n\nA) ${q.a}\nB) ${q.b}\nC) ${q.c}\nD) ${q.d}\n\nReply with A/B/C/D`;
}

async function pickQuestions(uid, count, topic = null) {
  const wrongIds = await redis.smembers(`user:${uid}:wrong`);
  const allIds = await redis.lrange("qbank:all", 0, -1);

  let pool = allIds;

  if (topic) {
    const ids = [];
    for (const id of allIds) {
      const raw = await redis.get(`q:${id}`);
      if (!raw) continue;
      const q = JSON.parse(raw);
      if ((q.topic || "").toLowerCase() === topic.toLowerCase()) ids.push(id);
    }
    pool = ids;
  }

  const uniq = [...new Set([...wrongIds, ...pool])];
  if (!uniq.length) return [];

  const picked = [];
  while (picked.length < count && uniq.length) {
    const i = Math.floor(Math.random() * uniq.length);
    picked.push(uniq[i]);
    uniq.splice(i, 1);
  }
  return picked;
}

async function updateStats(uid, correct) {
  const key = `user:${uid}:stats`;
  const day = todayKey();

  await redis.hincrby(key, "attempts", 1);
  await redis.hincrby(key, "correct", correct ? 1 : 0);

  const last = await redis.hget(key, "last_day");
  let streak = Number(await redis.hget(key, "streak") || "0");

  if (!last) streak = 1;
  else if (last === day) {}
  else {
    const d = new Date(day);
    const y = new Date(d.getTime() - 24 * 60 * 60 * 1000);
    const yKey = `${y.getFullYear()}-${String(y.getMonth()+1).padStart(2,"0")}-${String(y.getDate()).padStart(2,"0")}`;
    streak = (last === yKey) ? streak + 1 : 1;
  }

  await redis.hset(key, "streak", String(streak));
  await redis.hset(key, "last_day", day);
}

async function startQuiz(ctx, uid, count, topic = null) {
  const ids = await pickQuestions(uid, count, topic);
  if (!ids.length) return ctx.reply("No questions yet. Ask admin to add with /addq or /importq.");

  const session = { ids, idx: 0, correctCount: 0 };
  await redis.set(`session:${uid}`, JSON.stringify(session), "EX", 3600);

  const q = JSON.parse(await redis.get(`q:${ids[0]}`));
  await ctx.reply(formatQ(q, 1, ids.length));
}

async function handleAnswer(ctx, uid, text) {
  const rawS = await redis.get(`session:${uid}`);
  if (!rawS) return false;

  const ans = (text || "").trim().toUpperCase();
  if (!["A","B","C","D"].includes(ans)) {
    await ctx.reply("Reply with A / B / C / D 🙂");
    return true;
  }

  const session = JSON.parse(rawS);
  const qid = session.ids[session.idx];
  const q = JSON.parse(await redis.get(`q:${qid}`));

  const correct = (q.correct || "").toUpperCase() === ans;
  await updateStats(uid, correct);

  if (correct) {
    session.correctCount++;
    await redis.srem(`user:${uid}:wrong`, qid);
    await ctx.reply("✅ Correct!");
  } else {
    await redis.sadd(`user:${uid}:wrong`, qid);
    await ctx.reply(`❌ Wrong. Correct: ${q.correct}\nExplanation: ${q.explain || "—"}`);
  }

  session.idx++;

  if (session.idx >= session.ids.length) {
    await redis.del(`session:${uid}`);
    await ctx.reply(`🎉 Finished!\nScore: ${session.correctCount}/${session.ids.length}\nTry /progress`);
    return true;
  }

  await redis.set(`session:${uid}`, JSON.stringify(session), "EX", 3600);
  const nextId = session.ids[session.idx];
  const nq = JSON.parse(await redis.get(`q:${nextId}`));
  await ctx.reply(formatQ(nq, session.idx + 1, session.ids.length));
  return true;
}

module.exports = { startQuiz, handleAnswer };
