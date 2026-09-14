import { createStaffWithOptionalTeacher } from './create-staff-with-optional-teacher';

describe('createStaffWithOptionalTeacher', () => {
  it('creates a Staff row with no linked Teacher/User for a non-teacher hire', async () => {
    const tx = {
      staff: { create: jest.fn().mockResolvedValue({ id: 'st1', name: 'Nazir Ahmed' }) },
    } as any;

    const result = await createStaffWithOptionalTeacher(tx, {
      name: 'Nazir Ahmed',
      employeeType: 'JANITORIAL',
      campusId: 'cam1',
    });

    expect(result).toEqual({ id: 'st1', name: 'Nazir Ahmed' });
    expect(tx.staff.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ teacherId: undefined, userId: undefined }) }),
    );
  });

  it('creates a linked Teacher (and User) and wires their ids onto the Staff row for a TEACHER hire', async () => {
    const tx = {
      teacher: {
        create: jest.fn().mockResolvedValue({ id: 't1', userId: 'u1', name: 'Ayesha Khan' }),
        findUniqueOrThrow: jest.fn().mockResolvedValue({ id: 't1', userId: 'u1' }),
      },
      user: { create: jest.fn().mockResolvedValue({ id: 'u1', identifier: 'ayesha.khan' }) },
      staff: { create: jest.fn().mockResolvedValue({ id: 'st1', name: 'Ayesha Khan' }) },
    } as any;

    await createStaffWithOptionalTeacher(tx, {
      name: 'Ayesha Khan',
      employeeType: 'TEACHER',
      campusId: 'cam1',
      login: { identifier: 'ayesha.khan', password: 'a-strong-password' },
    });

    expect(tx.staff.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ teacherId: 't1', userId: 'u1' }) }),
    );
  });
});