const logger = require('../../config/logger');
const { ROLE_EVENT_MATRIX, renderNotification } = require('./eventCatalog');

/**
 * Single dispatch choke point.
 *
 * notify(client, { type, actorId, recipientIds, context })
 *
 * Defensive by contract: it NEVER throws. A notification bug must not roll back the
 * business `$transaction` it is called from. `client` is the same Prisma client the
 * caller is using (`tx` inside a transaction, or the `prisma` singleton).
 *
 * Algorithm:
 *  1. Dedupe recipientIds; drop actorId unless context.notifySelf.
 *  2. One query for recipients' role; keep only roles in ROLE_EVENT_MATRIX[type].roles.
 *  3. Load NotificationPreference rows for (users, type); drop any with in_app === false.
 *     Users with no row fall back to the matrix default (defaultInApp).
 *  4. renderNotification(type, context) → notification.createMany.
 *  5. Whole body wrapped in try/catch → logger.error and return.
 */
async function notify(client, { type, actorId = null, recipientIds = [], context = {} } = {}) {
  try {
    const matrix = ROLE_EVENT_MATRIX[type];
    if (!matrix) {
      logger.warn('notification_unknown_type', { type });
      return;
    }

    let ids = Array.from(new Set((recipientIds || []).filter(Boolean)));
    if (!context.notifySelf && actorId) ids = ids.filter((id) => id !== actorId);
    if (ids.length === 0) return;

    const users = await client.user.findMany({
      where: { id: { in: ids }, active: true },
      select: { id: true, role: true },
    });
    let eligible = users.filter((u) => matrix.roles.includes(u.role)).map((u) => u.id);
    if (eligible.length === 0) return;

    const prefs = await client.notificationPreference.findMany({
      where: { user_id: { in: eligible }, type },
      select: { user_id: true, in_app: true },
    });
    const prefMap = new Map(prefs.map((p) => [p.user_id, p.in_app]));
    eligible = eligible.filter((id) => (prefMap.has(id) ? prefMap.get(id) : matrix.defaultInApp !== false));
    if (eligible.length === 0) return;

    const env = renderNotification(type, context);
    await client.notification.createMany({
      data: eligible.map((user_id) => ({
        user_id,
        type,
        title: env.title,
        body: env.body,
        entity_type: env.entity_type,
        entity_id: env.entity_id,
        actor_id: actorId,
        metadata: env.metadata || {},
      })),
    });
  } catch (err) {
    logger.error('notification_dispatch_failed', { type, err });
  }
}

module.exports = { notify };
