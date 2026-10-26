import { SmartLogDiagnostic } from '@paas/shared-types';

interface DiagnosticRule {
  pattern: RegExp;
  errorCode: SmartLogDiagnostic['errorCode'];
  humanExplanation: string;
  suggestedFix: SmartLogDiagnostic['suggestedFix'];
}

/**
 * Inspects container stderr lines and translates known crash patterns into actionable diagnostics.
 */
export class SmartLogAnalyzerService {
  private readonly rules: DiagnosticRule[] = [
    {
      pattern: /(OutOfMemoryError|OOMKilled|Cannot allocate memory|exit code 137)/i,
      errorCode: 'OOM_KILLED',
      humanExplanation:
        'Container exceeded its RAM quota and was terminated by the Linux kernel OOM killer.',
      suggestedFix: 'INCREASE_MEMORY',
    },
    {
      pattern: /(EADDRINUSE|address already in use|Bind for 0\.0\.0\.0:\d+ failed)/i,
      errorCode: 'PORT_IN_USE',
      humanExplanation:
        'The target network port is already occupied. Reallocating an available host port will resolve this.',
      suggestedFix: 'REALLOCATE_PORT',
    },
    {
      pattern: /(password authentication failed for user|Access denied for user)/i,
      errorCode: 'DB_AUTH_FAILED',
      humanExplanation:
        'Database authentication failed due to mismatched credentials in environment variables.',
      suggestedFix: 'SYNC_DB_CREDENTIALS',
    },
    {
      pattern: /(ECONNREFUSED|Connection refused|could not connect to server)/i,
      errorCode: 'CONNECTION_REFUSED',
      humanExplanation:
        'Target dependency service refused the connection (it may still be booting or stopped).',
      suggestedFix: 'RESTART_DEPENDENCY',
    },
  ];

  analyzeLine(serviceId: string, logLine: string): SmartLogDiagnostic | null {
    for (const rule of this.rules) {
      if (rule.pattern.test(logLine)) {
        return {
          serviceId: serviceId,
          errorCode: rule.errorCode,
          rawLogExcerpt: logLine,
          humanExplanation: rule.humanExplanation,
          suggestedFix: rule.suggestedFix,
        };
      }
    }
    return null;
  }
}
