import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, nextTick, ref, type Ref } from 'vue';
import { flushPromises, mount } from '@vue/test-utils';
import { createPinia, setActivePinia } from 'pinia';
import { useAuthStore } from '../stores/auth';
import { api } from './api';
import { downloadAuthedFile, useAuthedImage } from './authedFile';

vi.mock('./api', () => ({ api: { fetchFile: vi.fn() } }));

describe('authedFile (BL-36)', () => {
  let created: Blob[];

  beforeEach(() => {
    setActivePinia(createPinia());
    useAuthStore().accessToken = 'token-1';
    vi.mocked(api.fetchFile).mockReset();
    created = [];
    let n = 0;
    vi.stubGlobal('URL', {
      ...URL,
      createObjectURL: vi.fn((b: Blob) => {
        created.push(b);
        return `blob:${++n}`;
      }),
      revokeObjectURL: vi.fn(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('downloads with the bearer token, as an octet-stream so an attachment never renders', async () => {
    vi.mocked(api.fetchFile).mockResolvedValue(new Blob(['<script>'], { type: 'text/html' }));
    const clicked: HTMLAnchorElement[] = [];
    const click = vi
      .spyOn(HTMLAnchorElement.prototype, 'click')
      .mockImplementation(function (this: HTMLAnchorElement) {
        clicked.push(this);
      });

    await downloadAuthedFile('/api/v1/files/f1', 'note.html');

    expect(api.fetchFile).toHaveBeenCalledWith('token-1', '/api/v1/files/f1');
    expect(created[0]?.type).toBe('application/octet-stream');
    expect(clicked[0]?.download).toBe('note.html');
    expect(clicked[0]?.href).toBe('blob:1');
    expect(clicked[0]?.isConnected).toBe(false);
    click.mockRestore();
  });

  it('refuses to download without a session', async () => {
    useAuthStore().accessToken = null;
    await expect(downloadAuthedFile('/api/v1/files/f1', 'x')).rejects.toThrow(/session has ended/);
    expect(api.fetchFile).not.toHaveBeenCalled();
  });

  function mountImage(path: Ref<string | null>) {
    let url!: ReturnType<typeof useAuthedImage>;
    const wrapper = mount(
      defineComponent({
        setup() {
          url = useAuthedImage(path);
          return () => h('img', { src: url.value ?? undefined, alt: '' });
        },
      }),
    );
    return { wrapper, url: () => url.value };
  }

  it('shows an image from a blob URL, follows the path and frees old URLs', async () => {
    vi.mocked(api.fetchFile).mockResolvedValue(new Blob(['png']));
    const path = ref<string | null>('/api/v1/files/a');
    const { wrapper, url } = mountImage(path);
    await flushPromises();
    expect(url()).toBe('blob:1');
    expect(api.fetchFile).toHaveBeenLastCalledWith('token-1', '/api/v1/files/a');

    path.value = '/api/v1/files/b';
    await nextTick();
    await flushPromises();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:1');
    expect(url()).toBe('blob:2');

    path.value = null;
    await nextTick();
    expect(url()).toBeNull();

    wrapper.unmount();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:2');
  });

  it('shows nothing when the image cannot be fetched', async () => {
    vi.mocked(api.fetchFile).mockRejectedValue(new Error('403'));
    const { url } = mountImage(ref<string | null>('/api/v1/files/a'));
    await flushPromises();
    expect(url()).toBeNull();
  });
});
