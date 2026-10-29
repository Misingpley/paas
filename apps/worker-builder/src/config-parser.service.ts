export interface ParsedConfigField {
  key: string;
  value: string | number | boolean;
  type: 'boolean' | 'number' | 'string';
}

/**
 * Bidirectional parser that converts key=value config files (e.g. server.properties) into UI form fields and back.
 */
export class ConfigParserService {
  parseProperties(rawText: string): ParsedConfigField[] {
    const fields: ParsedConfigField[] = [];

    for (const line of rawText.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;

      const key = trimmed.slice(0, idx).trim();
      const rawVal = trimmed.slice(idx + 1).trim();

      if (rawVal === 'true' || rawVal === 'false') {
        fields.push({ key, value: rawVal === 'true', type: 'boolean' });
      } else if (rawVal !== '' && !Number.isNaN(Number(rawVal))) {
        fields.push({ key, value: Number(rawVal), type: 'number' });
      } else {
        fields.push({ key, value: rawVal, type: 'string' });
      }
    }

    return fields;
  }

  serializeProperties(fields: ParsedConfigField[]): string {
    return fields.map((field) => `${field.key}=${field.value}`).join('\n');
  }
}
