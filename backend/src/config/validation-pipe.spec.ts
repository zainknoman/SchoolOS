import { Logger } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsOptional, IsString, ValidateNested } from 'class-validator';
import { ReportingValidationPipe } from './validation-pipe';

class AddressDto {
  @IsString()
  city!: string;
}

class PersonDto {
  @IsString()
  name!: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => AddressDto)
  address?: AddressDto;
}

/** KI-10: unknown request fields are still stripped, but no longer silently. */
describe('ReportingValidationPipe', () => {
  const pipe = new ReportingValidationPipe();
  const meta = { type: 'body' as const, metatype: PersonDto };
  let warn: jest.SpyInstance;

  beforeEach(() => {
    warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation();
  });
  afterEach(() => warn.mockRestore());

  it('strips unknown fields (top level and nested) and logs their names, never their values', async () => {
    const out = (await pipe.transform(
      { name: 'A', role: 'SUPER_ADMIN', address: { city: 'K', zip: '75500' } },
      meta,
    )) as Record<string, unknown>;

    expect(out).toEqual({ name: 'A', address: { city: 'K' } });
    expect(out).not.toHaveProperty('role');
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][0]);
    expect(line).toContain('PersonDto');
    expect(line).toContain('role');
    expect(line).toContain('address.zip');
    expect(line).not.toContain('SUPER_ADMIN');
    expect(line).not.toContain('75500');
  });

  it('logs nothing for a clean request', async () => {
    await pipe.transform({ name: 'A' }, meta);
    expect(warn).not.toHaveBeenCalled();
  });

  it('still rejects invalid input', async () => {
    await expect(pipe.transform({ name: 5 }, meta)).rejects.toThrow();
  });
});
