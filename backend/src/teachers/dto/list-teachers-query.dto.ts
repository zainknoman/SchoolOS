import { PageQueryDto } from '../../common/pagination';
import { IsOptional, IsString } from 'class-validator';

// Paging/search (BL-40) come from PageQueryDto.
export class ListTeachersQueryDto extends PageQueryDto {
  // A repeated param arrives as an array and `campusId[not]=x` as an object; both must be a 400,
  // not a Prisma error further down.
  @IsOptional()
  @IsString()
  campusId?: string;
}
