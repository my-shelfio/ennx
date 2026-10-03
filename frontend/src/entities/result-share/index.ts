export type { ResultShareCreated, ResultShareCreateRequest, SharedResult } from "./model/types";
export {
  activeShares,
  RESULT_SHARE_STORAGE_KEY,
  useIssuedResultShareStore,
} from "./model/store";
export type { IssuedResultShare, IssuedResultShareStore } from "./model/store";
export {
  DEFAULT_RETENTION_DAYS,
  daysUntilDeletion,
  describeDeletion,
  estimateExpiresAt,
  formatDeletionDate,
  MAX_RETENTION_DAYS,
  MIN_RETENTION_DAYS,
  RETENTION_DAY_OPTIONS,
} from "./lib/retention";
