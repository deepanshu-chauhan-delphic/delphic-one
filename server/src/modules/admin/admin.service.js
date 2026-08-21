const prisma = require('../../config/db');

const ENTITY_MODELS = {
  account: 'account',
  requirement: 'requirement',
  seat: 'requirementSeat',
  submission: 'submission',
};

async function unlock(entityType, entityId, reason, user) {
  const model = ENTITY_MODELS[entityType];
  if (!model) return { error: 'invalid_entity_type' };

  return prisma.$transaction(async (tx) => {
    const row = await tx[model].findUnique({ where: { id: entityId } });
    if (!row) return { error: 'not_found' };
    if (!row.is_locked) return { error: 'not_locked' };

    await tx[model].update({ where: { id: entityId }, data: { is_locked: false } });
    await tx.stageHistory.create({
      data: {
        entity_type: entityType,
        entity_id: entityId,
        from_stage: null,
        to_stage: 'unlocked',
        changed_by: user.id,
        reason,
      },
    });

    return {
      unlock: {
        entity_type: entityType,
        entity_id: entityId,
        unlocked_by: { id: user.id, name: user.name },
        reason,
      },
    };
  });
}

module.exports = { unlock, ENTITY_MODELS };
