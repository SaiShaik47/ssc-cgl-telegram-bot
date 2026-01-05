require("dotenv").config();

function must(name) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env var: ${name}`);
  return v;
}

module.exports = {
  BOT_TOKEN: must("BOT_TOKEN"),
  REDIS_URL: must("REDIS_URL"),
  ADMIN_ID: Number(must("ADMIN_ID")),
  STUDENT_ID: Number(must("STUDENT_ID"))
};
