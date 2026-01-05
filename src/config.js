require("dotenv").config();

function readNumber(name) {
  const raw = process.env[name];
  if (raw === undefined || raw === null || raw === "") return undefined;
  const parsed = Number(raw);
  return Number.isNaN(parsed) ? undefined : parsed;
}

const config = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  REDIS_URL: process.env.REDIS_URL,
  ADMIN_ID: readNumber("ADMIN_ID"),
  STUDENT_ID: readNumber("STUDENT_ID")
};

const requiredEntries = {
  BOT_TOKEN: config.BOT_TOKEN,
  REDIS_URL: config.REDIS_URL,
  ADMIN_ID: config.ADMIN_ID,
  STUDENT_ID: config.STUDENT_ID
};

config.missing = Object.entries(requiredEntries)
  .filter(([, value]) => value === undefined || value === null || value === "")
  .map(([key]) => key);

config.isValid = config.missing.length === 0;

if (!config.isValid) {
  console.error(
    `[Config] Missing environment variables: ${config.missing.join(", ")}.` +
      " Set them in Railway Variables to start the bot."
  );
}

module.exports = config;
