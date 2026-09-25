import { ArrayUnique, IsArray, IsIn } from 'class-validator';
import {
  STAFF_GRANTS,
  type StaffGrantName,
} from '../decorators/requires-grant.decorator';

export class SetGrantsDto {
  @IsArray()
  @ArrayUnique()
  @IsIn(STAFF_GRANTS, { each: true })
  grants!: StaffGrantName[];
}
