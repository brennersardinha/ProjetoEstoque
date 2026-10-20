CREATE TYPE "BalanceKind" AS ENUM ('CATEGORIA', 'PERSONALIZADO');

ALTER TABLE "balances"
  ADD COLUMN "kind" "BalanceKind" NOT NULL DEFAULT 'PERSONALIZADO',
  ADD COLUMN "category_id" UUID;

ALTER TABLE "balances"
  ADD CONSTRAINT "balances_category_id_fkey"
  FOREIGN KEY ("category_id") REFERENCES "categories"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "balances_category_id_idx" ON "balances"("category_id");
