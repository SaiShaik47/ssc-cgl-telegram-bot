const Redis = require("ioredis");
const config = require("./config");

if (!config.REDIS_URL) {
  console.error("[Redis] REDIS_URL missing; Redis client disabled.");
  module.exports = null;
  return;
}

const redis = new Redis(config.REDIS_URL, { maxRetriesPerRequest: 3 });
redis.on("error", (e) => console.error("Redis error:", e.message));

module.exports = redis;
