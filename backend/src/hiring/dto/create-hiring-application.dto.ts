import { IsEnum, IsString, MinLength } from 'class-validator';
import { EmployeeType } from '@prisma/client';

export class CreateHiringApplicationDto {
  @IsString() @MinLength(1) candidateId!: string;
  @IsEnum(EmployeeType) employeeType!: EmployeeType;
  @IsString() @MinLength(1) campusId!: string;
}
