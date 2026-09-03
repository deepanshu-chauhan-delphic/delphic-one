-- CreateIndex
CREATE INDEX "accounts_updated_at_idx" ON "accounts"("updated_at");

-- CreateIndex
CREATE INDEX "accounts_created_at_idx" ON "accounts"("created_at");

-- CreateIndex
CREATE INDEX "interview_rounds_scheduled_at_idx" ON "interview_rounds"("scheduled_at");

-- CreateIndex
CREATE INDEX "interview_rounds_completed_at_idx" ON "interview_rounds"("completed_at");

-- CreateIndex
CREATE INDEX "profiles_vendor_account_id_idx" ON "profiles"("vendor_account_id");

-- CreateIndex
CREATE INDEX "profiles_created_at_idx" ON "profiles"("created_at");

-- CreateIndex
CREATE INDEX "requirements_updated_at_idx" ON "requirements"("updated_at");

-- CreateIndex
CREATE INDEX "requirements_created_at_idx" ON "requirements"("created_at");

-- CreateIndex
CREATE INDEX "requirements_closed_at_idx" ON "requirements"("closed_at");

-- CreateIndex
CREATE INDEX "requirements_status_updated_at_idx" ON "requirements"("status", "updated_at");

-- CreateIndex
CREATE INDEX "requirements_sales_owner_id_status_idx" ON "requirements"("sales_owner_id", "status");

-- CreateIndex
CREATE INDEX "stage_history_entity_type_entity_id_changed_at_idx" ON "stage_history"("entity_type", "entity_id", "changed_at");

-- CreateIndex
CREATE INDEX "stage_history_changed_at_idx" ON "stage_history"("changed_at");

-- CreateIndex
CREATE INDEX "stage_history_changed_by_idx" ON "stage_history"("changed_by");

-- CreateIndex
CREATE INDEX "submissions_submitted_by_idx" ON "submissions"("submitted_by");

-- CreateIndex
CREATE INDEX "submissions_updated_at_idx" ON "submissions"("updated_at");

-- CreateIndex
CREATE INDEX "submissions_created_at_idx" ON "submissions"("created_at");

-- CreateIndex
CREATE INDEX "submissions_actual_joining_date_idx" ON "submissions"("actual_joining_date");

-- CreateIndex
CREATE INDEX "submissions_requirement_seat_id_stage_idx" ON "submissions"("requirement_seat_id", "stage");

-- CreateIndex
CREATE INDEX "submissions_submitted_by_created_at_idx" ON "submissions"("submitted_by", "created_at");
