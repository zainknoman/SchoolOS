import { mountOpenApiUi, serialiseOpenApi } from './openapi';
import { SwaggerModule, type OpenAPIObject } from '@nestjs/swagger';
import type { INestApplication } from '@nestjs/common';

describe('OpenAPI contract (BL-19)', () => {
  it('serialises with sorted keys so the committed file is stable', () => {
    const doc = {
      paths: { '/b': {}, '/a': {} },
      openapi: '3.0.0',
      info: { version: '1', title: 'x' },
    } as unknown as OpenAPIObject;
    const text = serialiseOpenApi(doc);
    expect(text.indexOf('"info"')).toBeLessThan(text.indexOf('"openapi"'));
    expect(text.indexOf('"/a"')).toBeLessThan(text.indexOf('"/b"'));
    expect(text.endsWith('\n')).toBe(true);
  });

  describe('interactive docs', () => {
    const setup = jest.spyOn(SwaggerModule, 'setup').mockImplementation();
    jest
      .spyOn(SwaggerModule, 'createDocument')
      .mockReturnValue({} as OpenAPIObject);
    const app = {} as INestApplication;
    afterEach(() => setup.mockClear());

    it('are on in development and test', () => {
      expect(mountOpenApiUi(app, { NODE_ENV: 'development' })).toBe(true);
      expect(setup).toHaveBeenCalledWith('api/docs', app, {});
    });

    it('are off in production unless OPENAPI_UI=enabled', () => {
      expect(mountOpenApiUi(app, { NODE_ENV: 'production' })).toBe(false);
      expect(setup).not.toHaveBeenCalled();
      expect(
        mountOpenApiUi(app, { NODE_ENV: 'production', OPENAPI_UI: 'enabled' }),
      ).toBe(true);
    });

    it('OPENAPI_UI=disabled turns them off everywhere', () => {
      expect(
        mountOpenApiUi(app, {
          NODE_ENV: 'development',
          OPENAPI_UI: 'disabled',
        }),
      ).toBe(false);
    });
  });
});
