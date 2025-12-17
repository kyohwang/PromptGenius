import { exportData, importData } from './repo';
import { ExportBundle, ImportStrategy } from './models';

export async function exportToJson(): Promise<string> {
  const bundle = await exportData();
  return JSON.stringify(bundle, null, 2);
}

export async function importFromJson(json: string, strategy: ImportStrategy): Promise<void> {
  let parsed: ExportBundle;
  try {
    parsed = JSON.parse(json) as ExportBundle;
  } catch (err) {
    throw new Error('Invalid JSON payload');
  }
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Empty import bundle');
  }
  await importData(parsed, strategy);
}
