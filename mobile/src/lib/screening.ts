import { createApiScreeningService } from '@/services/api-screening-service';
import { defaultKv } from '@/services/storage';

import { createAuthedClient } from './authed-client';

/** The app-wide screening service (real API only; there is no mock mode for screening). */
export const screeningService = createApiScreeningService(createAuthedClient(defaultKv));
