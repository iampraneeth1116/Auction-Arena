-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "RoomMember" ADD COLUMN     "hiddenAt" TIMESTAMP(3);
