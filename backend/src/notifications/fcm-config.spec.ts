import { ConfigService } from '@nestjs/config';
import { resolveFirebaseConfig } from './fcm-config';

function fakeConfig(values: Record<string, string>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

describe('resolveFirebaseConfig', () => {
  it('returns undefined when nothing is set', () => {
    expect(
      resolveFirebaseConfig(fakeConfig({ NODE_ENV: 'test' })),
    ).toBeUndefined();
  });

  it('returns a full config when all three vars are set, unescaping literal \\n in the private key', () => {
    const result = resolveFirebaseConfig(
      fakeConfig({
        NODE_ENV: 'production',
        FIREBASE_PROJECT_ID: 'schoolportal-prod',
        FIREBASE_CLIENT_EMAIL: 'fcm@schoolportal-prod.iam.gserviceaccount.com',
        FIREBASE_PRIVATE_KEY:
          '-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n',
      }),
    );

    expect(result).toEqual({
      projectId: 'schoolportal-prod',
      clientEmail: 'fcm@schoolportal-prod.iam.gserviceaccount.com',
      privateKey:
        '-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----\n',
    });
  });

  it('returns undefined for a partial config inside development/test', () => {
    expect(
      resolveFirebaseConfig(
        fakeConfig({
          NODE_ENV: 'development',
          FIREBASE_PROJECT_ID: 'schoolportal-prod',
        }),
      ),
    ).toBeUndefined();
  });

  it('throws for a partial config outside development/test', () => {
    expect(() =>
      resolveFirebaseConfig(
        fakeConfig({
          NODE_ENV: 'production',
          FIREBASE_PROJECT_ID: 'schoolportal-prod',
        }),
      ),
    ).toThrow(/Incomplete Firebase configuration/);
  });

  it('treats an unset NODE_ENV as strict, not development — a partial config is a startup error (BL-51)', () => {
    expect(() =>
      resolveFirebaseConfig(
        fakeConfig({ FIREBASE_PROJECT_ID: 'schoolportal-prod' }),
      ),
    ).toThrow();
  });
});
