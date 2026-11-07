import { createApiJournalService } from '@/services/journal-service';
import { defaultKv } from '@/services/storage';

import { createAuthedClient } from './authed-client';

/** The app-wide journal service (real API only). */
export const journalService = createApiJournalService(createAuthedClient(defaultKv));
