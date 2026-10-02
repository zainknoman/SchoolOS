import {
  checkRestoreTarget,
  compareSnapshot,
  dumpArgs,
  dumpFileName,
  parseDatabaseUrl,
  pgEnv,
  restoreArgs,
} from './db-backup';

describe('database backup/restore tooling (BL-13, A2)', () => {
  const conn = parseDatabaseUrl(
    'postgresql://ops%40x:p%40ss@db.internal:6543/schoolos?schema=public',
  );

  it('parses the connection URL, decoding user and password', () => {
    expect(conn).toEqual({
      host: 'db.internal',
      port: '6543',
      user: 'ops@x',
      password: 'p@ss',
      database: 'schoolos',
    });
    expect(() => parseDatabaseUrl('mysql://x@y/z')).toThrow('postgresql');
  });

  it('never puts the password on a command line', () => {
    const args = [...dumpArgs(conn, 'f.dump'), ...restoreArgs(conn, 'f.dump')];
    expect(args.join(' ')).not.toContain('p@ss');
    expect(pgEnv(conn).PGPASSWORD).toBe('p@ss');
    expect(dumpArgs(conn, 'f.dump')).toEqual(
      expect.arrayContaining([
        '--format=custom',
        '--no-owner',
        '-d',
        'schoolos',
      ]),
    );
  });

  it('restores only into a disposable database unless the name is repeated', () => {
    expect(checkRestoreTarget('schoolos_restore_rehearsal')).toEqual({
      ok: true,
    });
    expect(checkRestoreTarget('schoolos').ok).toBe(false);
    expect(checkRestoreTarget('schoolos', 'schoolos')).toEqual({ ok: true });
    expect(checkRestoreTarget('schoolos', 'other').ok).toBe(false);
  });

  it('reports every difference between the manifest and the restored database', () => {
    const backup = {
      migrations: ['a', 'b'],
      rowCounts: { User: 3, Student: 10 },
    };
    expect(compareSnapshot(backup, backup)).toEqual([]);
    expect(
      compareSnapshot(backup, {
        migrations: ['a'],
        rowCounts: { User: 3, Student: 9, Extra: 1 },
      }),
    ).toEqual([
      'migrations differ: backup has 2, restored has 1',
      'Extra: backup missing, restored 1',
      'Student: backup 10, restored 9',
    ]);
  });

  it('names dumps by database and time, safe for any file system', () => {
    expect(dumpFileName('schoolos', new Date('2026-10-02T09:30:00.000Z'))).toBe(
      'schoolos-2026-10-02T09-30-00-000Z.dump',
    );
  });
});
