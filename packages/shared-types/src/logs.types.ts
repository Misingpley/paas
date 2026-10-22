export type LogStreamType = 'stdout' | 'stderr';

export type KnownContainerErrorCode =
  | 'OOM_KILLED'
  | 'PORT_IN_USE'
  | 'DB_AUTH_FAILED'
  | 'CONNECTION_REFUSED'
  | 'IMAGE_PULL_FAILED';

export type QuickFixActionType =
  | 'INCREASE_MEMORY'
  | 'REALLOCATE_PORT'
  | 'SYNC_DB_CREDENTIALS'
  | 'RESTART_DEPENDENCY';

/**
 * Real-time log line streamed from host-agent via WebSockets.
 */
export interface ContainerLogChunk {
  serviceId: string;
  timestamp: string;
  stream: LogStreamType;
  message: string;
}

/**
 * Diagnostic payload emitted when the Smart Log Analyzer detects a known failure pattern.
 */
export interface SmartLogDiagnostic {
  serviceId: string;
  errorCode: KnownContainerErrorCode;
  rawLogExcerpt: string;
  humanExplanation: string;
  suggestedFix?: QuickFixActionType;
}
