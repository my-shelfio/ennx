export type {
  ConstraintEntry,
  MatchingEvent,
  MatchingInput,
  MatchingResult,
  ReportItem,
  SampleSummary,
  ValidateResult,
} from "./model/types";
export {
  MATCHING_INPUT_STORAGE_KEY,
  createInitialMatchingInput,
  useMatchingInputStore,
} from "./model/store";
export type { BulkInputPatch, MatchingInputStore } from "./model/store";
export { useMatchingResultStore } from "./model/resultStore";
export type { MatchingResultStore } from "./model/resultStore";
export { parseMatchingEvents } from "./lib/parseEvents";
export type { MatchingStepSnapshot } from "./lib/parseEvents";
export {
  buildDepartmentAssignments,
  buildEmployeeAssignmentRows,
  normalizeBlockingPairs,
  rankOfDepartmentForEmployee,
} from "./lib/assignment";
export type { DepartmentAssignmentView, EmployeeAssignmentRow } from "./lib/assignment";
export { DEPARTMENT_COUNT_MAX, EMPLOYEE_COUNT_MAX } from "./lib/limits";
export { resolveNames } from "./lib/names";
export {
  createEmptyMatrix,
  filledColumnsInRankOrder,
  isMatrixValid,
  matrixFromPrefs,
  prefsFromMatrix,
  rowFromOrderedColumns,
  updateCell,
  updateRow,
  validateRow,
} from "./lib/preferenceMatrix";
export type { RankCell, RankMatrix, RowValidation } from "./lib/preferenceMatrix";
export { buildEmployeeJourney } from "./lib/employeeJourney";
export type {
  DepartmentOutcome,
  EmployeeJourney,
  JourneyPrefs,
  JourneyStep,
  JourneyStepKind,
} from "./lib/employeeJourney";
export {
  classifyRejectReason,
  describeRejectionCause,
  isReturnToWaitlist,
  parseCutoffRaise,
  rejectionCauseLabel,
} from "./lib/rejectionCause";
export type { RejectionCause } from "./lib/rejectionCause";
export { buildDepartmentBreakdown } from "./lib/departmentBreakdown";
export type {
  DepartmentApplicant,
  DepartmentBreakdown,
  DepartmentCutoff,
} from "./lib/departmentBreakdown";
export {
  compareByDistanceFromPreference,
  DEFAULT_FOLLOW_UP_THRESHOLD,
  extractFollowUpEmployees,
  FOLLOW_UP_THRESHOLDS,
  isFollowUpTarget,
} from "./lib/followUp";
export type {
  FollowUpEmployee,
  FollowUpHigherChoice,
  FollowUpThreshold,
} from "./lib/followUp";
