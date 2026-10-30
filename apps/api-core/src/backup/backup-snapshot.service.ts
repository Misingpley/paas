export interface BackupMetadata {
  snapshotId: string;
  serviceId: string;
  sizeBytes: number;
  createdAtMs: number;
}

/**
 * Manages S3 archive paths and retention rotation for container volume snapshots (MinIO / S3).
 */
export class BackupSnapshotService {
  /**
   * Builds a sanitized S3 object key for a compressed volume snapshot tarball.
   */
  buildS3ObjectKey(projectId: string, serviceId: string, timestampIso: string): string {
    const safeTimestamp = timestampIso.replace(/[:.]/g, '-');
    return `backups/${projectId}/${serviceId}/snapshot-${safeTimestamp}.tar.gz`;
  }

  /**
   * Evaluates snapshot retention policy and returns expired snapshots exceeding maxKeepCount.
   */
  selectExpiredSnapshots(snapshots: BackupMetadata[], maxKeepCount: number): BackupMetadata[] {
    const sorted = [...snapshots].sort((a, b) => b.createdAtMs - a.createdAtMs);
    return sorted.slice(maxKeepCount);
  }
}
