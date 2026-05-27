import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export async function downloadAllAsZip(results) {
  const zip = new JSZip();
  for (const r of results) {
    if (r.blob && r.status === 'done') {
      zip.file(r.outputName, r.blob);
    }
  }
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'pineapple-pictures.zip');
}

export function downloadSingle(result) {
  saveAs(result.blob, result.outputName);
}
