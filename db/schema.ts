import { sqliteTable, text, integer, real, primaryKey, index, uniqueIndex } from 'drizzle-orm/sqlite-core';
export const accounts = sqliteTable('accounts', { id: text('id').primaryKey(), name: text('name').notNull(), role: text('role').notNull(), coopId: text('coop_id').notNull(), createdAt: text('created_at').notNull() });
export const demoSessions = sqliteTable('demo_sessions', { token: text('token').primaryKey(), rootId: text('root_id').notNull(), userId: text('user_id').notNull(), name: text('name').notNull(), role: text('role').notNull(), coopId: text('coop_id').notNull(), expiresAt: text('expires_at').notNull() });
export const records = sqliteTable('business_records', { id: text('id').primaryKey(), kind: text('kind').notNull(), coopId: text('coop_id').notNull(), ownerId: text('owner_id').notNull(), data: text('data').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull() }, t => [index('records_scope').on(t.coopId, t.kind)]);
export const changes = sqliteTable('record_changes', { id: text('id').primaryKey(), recordId: text('record_id').notNull(), coopId: text('coop_id').notNull(), actorId: text('actor_id').notNull(), data: text('data').notNull(), createdAt: text('created_at').notNull() }, t => [index('changes_record').on(t.recordId)]);
export const scientificImports = sqliteTable('scientific_imports', { id: text('id').primaryKey(), coopId: text('coop_id').notNull(), ownerId: text('owner_id').notNull(), hash: text('hash').notNull(), data: text('data').notNull(), createdAt: text('created_at').notNull() }, t => [uniqueIndex('imports_scope').on(t.coopId, t.hash)]);
export const invitations = sqliteTable('invitations', { id: text('id').primaryKey(), tokenHash: text('token_hash').notNull(), coopId: text('coop_id').notNull(), role: text('role').notNull(), memberId: text('member_id'), email: text('email'), createdBy: text('created_by').notNull(), expiresAt: text('expires_at').notNull(), acceptedBy: text('accepted_by'), acceptedAt: text('accepted_at') }, t => [index('invitations_token').on(t.tokenHash)]);
export const scientificForecasts = sqliteTable('scientific_forecasts', { id: text('id').primaryKey(), coopId: text('coop_id').notNull(), importId: text('import_id').notNull(), data: text('data').notNull(), createdAt: text('created_at').notNull() }, t => [index('forecasts_scope').on(t.coopId)]);
export const seasonalCampaigns = sqliteTable('seasonal_campaigns', {
  id: text('id').primaryKey(), coopId: text('coop_id').notNull(), ownerId: text('owner_id').notNull(), revision: integer('revision').notNull(),
  config: text('config').notNull(), events: text('events').notNull(), plan: text('plan').notNull(), demo: integer('demo').notNull(), createdAt: text('created_at').notNull(), updatedAt: text('updated_at').notNull(),
}, t => [index('seasonal_campaign_scope').on(t.coopId,t.ownerId)]);
export const seasonalRevisions = sqliteTable('seasonal_revisions', {
  campaignId: text('campaign_id').notNull().references(()=>seasonalCampaigns.id), revision: integer('revision').notNull(), actorId: text('actor_id').notNull(),
  config: text('config').notNull(), events: text('events').notNull(), plan: text('plan').notNull(), reason: text('reason').notNull(), createdAt: text('created_at').notNull(),
}, t => [primaryKey({columns:[t.campaignId,t.revision]})]);

export const landJobs=sqliteTable('land_jobs',{
 id:text('id').primaryKey(),coopId:text('coop_id').notNull(),ownerId:text('owner_id').notNull(),geometry:text('geometry').notNull(),createdAt:text('created_at').notNull(),completedAt:text('completed_at'),total:integer('total').notNull(),result:text('result'),
},t=>[index('land_jobs_owner').on(t.coopId,t.ownerId,t.createdAt)]);
export const landSectors=sqliteTable('land_sectors',{
 jobId:text('job_id').notNull().references(()=>landJobs.id),sector:integer('sector').notNull(),geometry:text('geometry').notNull(),areaM2:real('area_m2').notNull(),result:text('result'),lease:text('lease'),leaseAt:text('lease_at'),error:text('error'),
},t=>[primaryKey({columns:[t.jobId,t.sector]})]);
