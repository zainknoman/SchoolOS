-- BL-06 (M10, part 3; additive): report cards generated from the gradebook, versioned and immutable.
-- Class/term FKs are NO ACTION: deleting a class, term or school with issued cards is refused at the
-- end of the statement (issued cards are retained records).
-- CreateTable
CREATE TABLE "GeneratedReportCard" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "classId" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "overallPercent" DOUBLE PRECISION NOT NULL,
    "overallLetter" TEXT,
    "remark" TEXT,
    "issuedById" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TIMESTAMP(3),

    CONSTRAINT "GeneratedReportCard_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GeneratedReportCard_classId_termId_idx" ON "GeneratedReportCard"("classId", "termId");

-- CreateIndex
CREATE UNIQUE INDEX "GeneratedReportCard_studentId_termId_version_key" ON "GeneratedReportCard"("studentId", "termId", "version");

-- AddForeignKey
ALTER TABLE "GeneratedReportCard" ADD CONSTRAINT "GeneratedReportCard_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReportCard" ADD CONSTRAINT "GeneratedReportCard_classId_fkey" FOREIGN KEY ("classId") REFERENCES "Class"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReportCard" ADD CONSTRAINT "GeneratedReportCard_termId_fkey" FOREIGN KEY ("termId") REFERENCES "Term"("id") ON DELETE NO ACTION ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GeneratedReportCard" ADD CONSTRAINT "GeneratedReportCard_issuedById_fkey" FOREIGN KEY ("issuedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Issued cards are immutable: only supersededAt may change, once (NULL -> timestamp). issuedById is
-- left out so deleting the issuing user (ON DELETE SET NULL) still works.
CREATE FUNCTION "generated_report_card_immutable"() RETURNS trigger AS $$
BEGIN
  IF (NEW."id", NEW."studentId", NEW."classId", NEW."termId", NEW."version", NEW."snapshot",
      NEW."overallPercent", NEW."overallLetter", NEW."remark", NEW."issuedAt")
     IS DISTINCT FROM
     (OLD."id", OLD."studentId", OLD."classId", OLD."termId", OLD."version", OLD."snapshot",
      OLD."overallPercent", OLD."overallLetter", OLD."remark", OLD."issuedAt") THEN
    RAISE EXCEPTION 'An issued report card cannot be changed; generate a new version instead';
  END IF;
  IF OLD."supersededAt" IS NOT NULL AND NEW."supersededAt" IS DISTINCT FROM OLD."supersededAt" THEN
    RAISE EXCEPTION 'A superseded report card stays superseded';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "GeneratedReportCard_immutable"
  BEFORE UPDATE ON "GeneratedReportCard"
  FOR EACH ROW EXECUTE FUNCTION "generated_report_card_immutable"();
