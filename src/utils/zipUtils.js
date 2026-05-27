import JSZip from 'jszip';
import { saveAs } from 'file-saver';

export async function downloadAllAsZip(results) {
  const zip = new JSZip();
  const seen = {};
  for (const r of results) {
    if (r.blob && r.status === 'done') {
      let name = r.outputName;
      // Deduplicate filenames so the ZIP always contains every file
      if (name in seen) {
        seen[name]++;
        const dot = name.lastIndexOf('.');
        name = dot >= 0
          ? `${name.slice(0, dot)}_${seen[name]}${name.slice(dot)}`
          : `${name}_${seen[name]}`;
      } else {
        seen[name] = 0;
      }
      zip.file(name, r.blob);
    }
  }
  const content = await zip.generateAsync({ type: 'blob' });
  saveAs(content, 'pineapple-pictures.zip');
}

export function downloadSingle(result) {
  saveAs(result.blob, result.outputName);
}
