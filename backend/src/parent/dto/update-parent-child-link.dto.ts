import { IsBoolean, IsOptional, IsString, MinLength } from 'class-validator';

/** Per-child guardian flags on the StudentParent join row. */
export class UpdateParentChildLinkDto {
  @IsOptional() @IsBoolean() isPrimary?: boolean;
  @IsOptional() @IsBoolean() isEmergencyContact?: boolean;
  @IsOptional() @IsString() @MinLength(1) relationship?: string;
}
