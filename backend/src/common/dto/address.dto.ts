import { IsOptional, IsString, MinLength } from 'class-validator';

// Shared by every entity that needs an address (Student today; Parent/Teacher in their own
// sub-projects reuse this same DTO rather than duplicating the field list).
export class AddressDto {
  @IsString()
  @MinLength(1)
  line1!: string;

  @IsOptional() @IsString() line2?: string;
  @IsOptional() @IsString() area?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() district?: string;
  @IsOptional() @IsString() province?: string;
  @IsOptional() @IsString() postalCode?: string;
  @IsOptional() @IsString() country?: string;
}
