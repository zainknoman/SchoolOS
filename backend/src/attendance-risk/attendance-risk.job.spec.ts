import { Test } from '@nestjs/testing';
import { AttendanceRiskJob } from './attendance-risk.job';
import { AttendanceRiskService } from './attendance-risk.service';

describe('AttendanceRiskJob', () => {
  let job: AttendanceRiskJob;
  let attendanceRiskService: { recomputeAll: jest.Mock };

  beforeEach(async () => {
    attendanceRiskService = { recomputeAll: jest.fn() };
    const moduleRef = await Test.createTestingModule({
      providers: [
        AttendanceRiskJob,
        { provide: AttendanceRiskService, useValue: attendanceRiskService },
      ],
    }).compile();
    job = moduleRef.get(AttendanceRiskJob);
  });

  it('delegates to AttendanceRiskService.recomputeAll()', async () => {
    attendanceRiskService.recomputeAll.mockResolvedValue(undefined);

    await job.run();

    expect(attendanceRiskService.recomputeAll).toHaveBeenCalledTimes(1);
  });

  it('catches a recompute failure and does not let it propagate (nightly job must not crash the process)', async () => {
    attendanceRiskService.recomputeAll.mockRejectedValue(
      new Error('db unreachable'),
    );

    await expect(job.run()).resolves.toBeUndefined();
  });
});
