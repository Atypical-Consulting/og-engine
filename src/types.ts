import type { ApiKeyRecord } from './db';

export type AppEnv = {
  Variables: {
    apiKey: ApiKeyRecord;
  };
};
