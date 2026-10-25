-- AlterTable
ALTER TABLE "RoomMember" ADD COLUMN     "battingOrder" TEXT[] DEFAULT ARRAY[]::TEXT[];
