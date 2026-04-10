import type { ApiKeyRecord, UserRecord } from './db';

export type AppEnv = {
  Variables: {
    apiKey: ApiKeyRecord;
    user: UserRecord;
  };
};

export type { UserRecord };
