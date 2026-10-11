import { pgTable, index, uniqueIndex, varchar, numeric, timestamp, serial, foreignKey, text, boolean } from "drizzle-orm/pg-core"
import { sql } from "drizzle-orm"



export const users = pgTable("users", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	// 共享身份：手机号（唯一），小程序与 App 均以此作为「同一客户」标识
	phone: varchar({ length: 11 }),
	nickname: varchar({ length: 128 }).notNull(),
	signature: text(),
	gender: varchar({ length: 10 }),
	birthDate: varchar("birth_date", { length: 10 }),
	height: numeric({ precision: 5, scale:  1 }),
	targetWeight: numeric("target_weight", { precision: 5, scale:  1 }),
	targetWaist: numeric("target_waist", { precision: 5, scale:  1 }),
	reminderTime: varchar("reminder_time", { length: 5 }),
	avatarUrl: varchar("avatar_url", { length: 512 }),
	// 预留微信 openid 绑定
	openid: varchar({ length: 64 }),
	// 是否已完成引导/资料填写
	onboarded: boolean().default(false),
	// 健康指标（由打卡记录计算并回写）
	currentWeight: numeric("current_weight", { precision: 5, scale:  1 }),
	currentWaist: numeric("current_waist", { precision: 5, scale:  1 }),
	bmi: numeric({ precision: 4, scale:  1 }),
	bmiLevel: varchar("bmi_level", { length: 20 }),
	bodyFatRate: numeric("body_fat_rate", { precision: 5, scale:  1 }),
	bodyFatLevel: varchar("body_fat_level", { length: 20 }),
	waistLevel: varchar("waist_level", { length: 20 }),
	lastCheckinDate: varchar("last_checkin_date", { length: 10 }),
	initialWeight: numeric("initial_weight", { precision: 5, scale:  1 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("users_created_at_idx").using("btree", table.createdAt.asc().nullsLast().op("timestamptz_ops")),
	uniqueIndex("users_phone_idx").on(table.phone),
]);

export const healthCheck = pgTable("health_check", {
	id: serial().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }).defaultNow(),
});

export const weightRecords = pgTable("weight_records", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	recordDate: varchar("record_date", { length: 10 }).notNull(),
	weight: numeric({ precision: 5, scale:  1 }).notNull(),
	waist: numeric({ precision: 5, scale:  1 }),
	note: text(),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
}, (table) => [
	index("weight_records_record_date_idx").using("btree", table.recordDate.asc().nullsLast().op("text_ops")),
	index("weight_records_user_date_idx").using("btree", table.userId.asc().nullsLast().op("text_ops"), table.recordDate.asc().nullsLast().op("text_ops")),
	index("weight_records_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "weight_records_user_id_users_id_fk"
		}).onDelete("cascade"),
]);

export const globalNotifications = pgTable("global_notifications", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	title: varchar({ length: 255 }).notNull(),
	content: text().notNull(),
	type: varchar({ length: 20 }).default('system'),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
	updatedAt: timestamp("updated_at", { withTimezone: true, mode: 'string' }),
});

export const userNotifications = pgTable("user_notifications", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }).notNull(),
	notificationId: varchar("notification_id", { length: 36 }).notNull(),
	isRead: boolean("is_read").default(false),
	readAt: timestamp("read_at", { withTimezone: true, mode: 'string' }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("user_notifications_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "user_notifications_user_id_users_id_fk"
		}).onDelete("cascade"),
	foreignKey({
			columns: [table.notificationId],
			foreignColumns: [globalNotifications.id],
			name: "user_notifications_notification_id_global_notifications_id_fk"
		}).onDelete("cascade"),
]);

export const feedback = pgTable("feedback", {
	id: varchar({ length: 36 }).default(sql`gen_random_uuid()`).primaryKey().notNull(),
	userId: varchar("user_id", { length: 36 }),
	content: text().notNull(),
	contact: varchar({ length: 128 }),
	createdAt: timestamp("created_at", { withTimezone: true, mode: 'string' }).defaultNow().notNull(),
}, (table) => [
	index("feedback_user_id_idx").using("btree", table.userId.asc().nullsLast().op("text_ops")),
	foreignKey({
			columns: [table.userId],
			foreignColumns: [users.id],
			name: "feedback_user_id_users_id_fk"
		}).onDelete("set null"),
]);
