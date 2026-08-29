export interface PushPayload {
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushAdapter {
  send(userId: string, payload: PushPayload): Promise<void>;
}

export const PUSH_ADAPTER = 'PUSH_ADAPTER';
