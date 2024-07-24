SELECT 
    "User"."username",
	"User"."id",
    COUNT("Activity"."id") AS activity_count
FROM 
    "User"
LEFT JOIN 
    "Activity" ON "User"."id" = "Activity"."userId"
GROUP BY 
    "User"."id", "User"."username"
ORDER BY 
    activity_count DESC;