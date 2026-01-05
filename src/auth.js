const { ADMIN_ID, STUDENT_ID } = require("./config");

function gate(ctx) {
  const uid = Number(ctx.from?.id || 0);
  if (uid === ADMIN_ID) return { ok: true, role: "admin" };
  if (uid === STUDENT_ID) return { ok: true, role: "student" };
  return { ok: false, role: "none" };
}

function isAdmin(ctx) {
  return Number(ctx.from?.id || 0) === ADMIN_ID;
}

module.exports = { gate, isAdmin };
