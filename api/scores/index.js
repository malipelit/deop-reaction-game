const { TableClient } = require("@azure/data-tables");

module.exports = async function (context, req) {
  try {
    const top = Math.max(1, Math.min(50, parseInt(req.query.top || "10", 10) || 10));

    const conn = process.env.TABLE_CONNECTION;
    const tableName = process.env.TABLE_NAME || "scores";
    const client = TableClient.fromConnectionString(conn, tableName);

    // Query all the entities in partition "scores"
    const results = [];
    const filter = `PartitionKey eq 'scores'`;

    for await (const entity of client.listEntities({ queryOptions: { filter } })) {
      results.push({
        player: entity.player,
        bestMs: entity.bestMs,
        updatedAt: entity.updatedAt
      });
    }

    // Sort fastest first, return top N
    results.sort((a, b) => (a.bestMs ?? 1e9) - (b.bestMs ?? 1e9));

    context.res = { status: 200, body: results.slice(0, top) };
  } catch (err) {
    context.log(err);
    context.res = { status: 500, body: { error: "Server error." } };
  }
};