SELECT "Activity".*, "User"."username"
FROM "Activity"
LEFT JOIN "User" ON "Activity"."userId" = "User"."id"
	-- WHERE "userId" = 'clwj0jrx90028sgvmd3e0wnsv'
WHERE "Activity"."duration" IS NULL AND "Activity"."activityType" = 'activity'
ORDER BY "Activity"."createdAt" ASC;