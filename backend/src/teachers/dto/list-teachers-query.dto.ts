import { IsOptional, IsString } from 'class-validator';

export class ListTeachersQueryDto {
  // A repeated param arrives as an array and `campusId[not]=x` as an object; both must be a 400,
  // not a Prisma error further down.
  @IsOptional()
  @IsString()
  campusId?: string;
}
