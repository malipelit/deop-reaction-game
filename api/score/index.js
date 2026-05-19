const { TableClient } = require("@azure/data-tables");

function normalizeName(name) {
  return String(name || "")
    .trim()
    .slice(0, 24);
}

function rowKeyFromName(name) {
  // lowercased + replace spaces with underscores
  return name.toLowerCase().replace(/\s+/g, "_");
}

module.exports = async function (context, req) {
  try {
    const player = normalizeName(req.body?.player);
    const reactionMs = Number(req.body?.reactionMs);

    if (!player) {
      context.res = { status: 400, body: { error: "Player name required." } };
      return;
    }
    if (!Number.isFinite(reactionMs) || reactionMs < 80 || reactionMs > 60000) {
      context.res = { status: 400, body: { error: "reactionMs must be 80–60000." } };
      return;
    }

    const conn = process.env.TABLE_CONNECTION;
    const tableName = process.env.TABLE_NAME || "scores";
    const client = TableClient.fromConnectionString(conn, tableName);

    const partitionKey = "scores";
    const rowKey = rowKeyFromName(player);

    // Read current best (if any)
    let existing = null;
    try {
      existing = await client.getEntity(partitionKey, rowKey);
    } catch (e) {
      // Not found is OK
    }

    const newBest = Math.round(reactionMs);
    const shouldUpdate =
      !existing || !Number.isFinite(existing.bestMs) || newBest < existing.bestMs;

    if (shouldUpdate) {
      const entity = {
        partitionKey,
        rowKey,
        player,            // display name
        bestMs: newBest,
        updatedAt: new Date().toISOString()
      };

      // Upsert = insert if missing, update if exists
      await client.upsertEntity(entity, "Replace");
      context.res = { status: 200, body: { ok: true, updated: true, entity } };
    } else {
      context.res = {
        status: 200,
        body: { ok: true, updated: false, currentBest: existing.bestMs }
      };
    }
  } catch (err) {
    context.log(err);
    context.res = { status: 500, body: { error: "Server error." } };
  }
};