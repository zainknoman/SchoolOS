import * as argon2 from 'argon2';
import { createParentWithUser } from './create-parent-with-user';

jest.mock('argon2', () => ({ hash: jest.fn() }));

describe('createParentWithUser', () => {
  it('hashes the password, creates a User with role PARENT, then a linked ParentProfile', async () => {
    jest.mocked(argon2.hash).mockResolvedValue('hashed-password');
    const tx = {
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'u1',
          identifier: 'parent-x@schoolos.edu.pk',
        }),
      },
      parentProfile: {
        create: jest.fn().mockResolvedValue({
          id: 'p1',
          name: 'New Parent',
          phone: '0300-1234567',
        }),
      },
    };

    const result = await createParentWithUser(tx as never, {
      identifier: 'parent-x@schoolos.edu.pk',
      password: 'ChangeMe123!',
      name: 'New Parent',
      phone: '0300-1234567',
    });

    expect(argon2.hash).toHaveBeenCalledWith('ChangeMe123!');
    expect(tx.user.create).toHaveBeenCalledWith({
      data: {
        identifier: 'parent-x@schoolos.edu.pk',
        passwordHash: 'hashed-password',
        role: 'PARENT',
      },
    });
    expect(tx.parentProfile.create).toHaveBeenCalledWith({
      data: { userId: 'u1', name: 'New Parent', phone: '0300-1234567' },
    });
    expect(result).toEqual({
      id: 'p1',
      identifier: 'parent-x@schoolos.edu.pk',
      name: 'New Parent',
      phone: '0300-1234567',
    });
  });

  it('creates a ParentProfile with no phone when none is given', async () => {
    jest.mocked(argon2.hash).mockResolvedValue('hashed-password');
    const tx = {
      user: {
        create: jest.fn().mockResolvedValue({
          id: 'u2',
          identifier: 'parent-y@schoolos.edu.pk',
        }),
      },
      parentProfile: {
        create: jest
          .fn()
          .mockResolvedValue({ id: 'p2', name: 'Another Parent', phone: null }),
      },
    };

    await createParentWithUser(tx as never, {
      identifier: 'parent-y@schoolos.edu.pk',
      password: 'ChangeMe123!',
      name: 'Another Parent',
    });

    expect(tx.parentProfile.create).toHaveBeenCalledWith({
      data: { userId: 'u2', name: 'Another Parent', phone: undefined },
    });
  });
});
