-- AlterTable
ALTER TABLE "Recording" ADD COLUMN     "nisqaColPred" DOUBLE PRECISION,
ADD COLUMN     "nisqaDisPred" DOUBLE PRECISION,
ADD COLUMN     "nisqaLoudPred" DOUBLE PRECISION,
ADD COLUMN     "nisqaModel" TEXT,
ADD COLUMN     "nisqaNoiPred" DOUBLE PRECISION;
