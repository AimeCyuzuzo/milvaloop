import { loadEnv, serverEnvSchema } from '@milvaloop/config';

export const env = loadEnv(serverEnvSchema);
