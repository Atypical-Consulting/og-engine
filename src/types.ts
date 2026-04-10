import type { ApiKeyRecord, UserRecord } from './db';

export type AppEnv = {
  Variables: {
    apiKey: ApiKeyRecord;
  };
};

export type { UserRecord };
