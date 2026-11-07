import { createApiMoodService } from '@/services/mood-service';
import { defaultKv } from '@/services/storage';

import { createAuthedClient } from './authed-client';

/** The app-wide mood service (real API only). */
export const moodService = createApiMoodService(createAuthedClient(defaultKv));
