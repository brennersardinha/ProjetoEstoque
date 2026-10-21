CREATE TABLE "balance_categories" (
    "balance_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,

    CONSTRAINT "balance_categories_pkey" PRIMARY KEY ("balance_id", "category_id")
);

ALTER TABLE "balance_items" ADD COLUMN "selected_individually" BOOLEAN NOT NULL DEFAULT true;

INSERT INTO "balance_categories" ("balance_id", "category_id")
SELECT "id", "category_id" FROM "balances" WHERE "category_id" IS NOT NULL
ON CONFLICT DO NOTHING;

ALTER TABLE "balance_categories" ADD CONSTRAINT "balance_categories_balance_id_fkey"
FOREIGN KEY ("balance_id") REFERENCES "balances"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "balance_categories" ADD CONSTRAINT "balance_categories_category_id_fkey"
FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "balance_categories_category_id_idx" ON "balance_categories"("category_id");
