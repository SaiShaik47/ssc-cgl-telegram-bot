const Redis = require("ioredis");
const { REDIS_URL } = require("./config");

const redis = new Redis(REDIS_URL, { maxRetriesPerRequest: 3 });
redis.on("error", (e) => console.error("Redis error:", e.message));

module.exports = redis;
