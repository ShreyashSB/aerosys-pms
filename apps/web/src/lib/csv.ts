export type CsvColumn<T> = { header: string; value: (row: T) => string | number };

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const esc = (v: string | number) => {
    const s = String(v ?? "");
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [columns.map((c) => esc(c.header)).join(",")];
  for (const r of rows) lines.push(columns.map((c) => esc(c.value(r))).join(","));
  return lines.join("\n");
}

/** True when the app was opened from a phone's home screen rather than in a browser tab. */
function isInstalledApp(): boolean {
  return (
    window.matchMedia?.("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/**
 * Triggers a download. The UTF-8 BOM makes Excel open ₹ and other characters correctly.
 *
 * Opened from the home screen, iPhones often ignore file downloads, so there the phone's share sheet opens instead
 * (Save to Files, WhatsApp, Mail…). Must be called straight from a tap, as the share sheet needs one.
 */
export function downloadCsv(filename: string, csv: string) {
  const name = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });

  if (isInstalledApp() && typeof File !== "undefined" && navigator.canShare) {
    const file = new File([blob], name, { type: "text/csv" });
    if (navigator.canShare({ files: [file] })) {
      navigator.share({ files: [file], title: name }).catch((err: unknown) => {
        // Closing the share sheet is not an error; anything else falls back to a normal download.
        if ((err as { name?: string })?.name !== "AbortError") saveBlob(blob, name);
      });
      return;
    }
  }
  saveBlob(blob, name);
}

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Freeing the file straight after the click can cancel the download on iPhones, so wait a minute.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
