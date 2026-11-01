ALTER TABLE "tournaments" DROP COLUMN IF EXISTS "prize_pool_inr";
ALTER TABLE "tournaments" ALTER COLUMN "start_time" DROP NOT NULL;
