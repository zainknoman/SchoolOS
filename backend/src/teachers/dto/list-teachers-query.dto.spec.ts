import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { ListTeachersQueryDto } from './list-teachers-query.dto';

describe('ListTeachersQueryDto', () => {
  const pipe = new ValidationPipe({ whitelist: true, transform: true });
  const run = (value: unknown) =>
    pipe.transform(value, { type: 'query', metatype: ListTeachersQueryDto });

  it('accepts a single campusId string and an absent one', async () => {
    await expect(run({ campusId: 'abc' })).resolves.toMatchObject({ campusId: 'abc' });
    await expect(run({})).resolves.toBeDefined();
  });

  it('rejects a repeated campusId (array)', async () => {
    await expect(run({ campusId: ['a', 'b'] })).rejects.toThrow(BadRequestException);
  });

  it('rejects an object-valued campusId (campusId[not]=x)', async () => {
    await expect(run({ campusId: { not: 'x' } })).rejects.toThrow(BadRequestException);
  });
});
