-- Numeração da grade (solados 34 a 40); 0 indica item sem grade.
ALTER TABLE "balance_items" ADD COLUMN "size" INTEGER NOT NULL DEFAULT 0;

DROP INDEX "balance_items_balance_id_product_id_key";

CREATE UNIQUE INDEX "balance_items_balance_id_product_id_size_key" ON "balance_items"("balance_id", "product_id", "size");
