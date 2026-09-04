import * as XLSX from "xlsx";

export interface ExportOptions {
  filename: string;
  sheetName?: string;
  headers: string[];
  rows: (string | number | undefined | null)[][];
  phoneColIndices?: number[];
  phoneColumnIndices?: number[];
}

/**
 * Formats a phone number string for export
 */
export function formatPhoneNumberForExport(phone?: string | number | null): string {
  if (!phone) return "";
  return String(phone).trim();
}

/**
 * Exports data to a clean, professionally formatted Excel (.xlsx) file.
 * Explicitly sets cell types to string ('s') and text format ('@') for all phone columns,
 * completely preventing Excel from converting phone numbers into scientific notation (e.g. 9.18E+11).
 */
export function exportToExcel({
  filename,
  sheetName = "Campaign Report",
  headers,
  rows,
  phoneColIndices,
  phoneColumnIndices,
}: ExportOptions) {
  if (!rows || rows.length === 0) {
    throw new Error("No data available to export.");
  }

  const resolvedPhoneCols = phoneColIndices || phoneColumnIndices || [0];

  // 1. Clean matrix
  const cleanRows = rows.map((row) =>
    row.map((cell) => {
      if (cell === null || cell === undefined) return "";
      return String(cell).trim();
    })
  );

  const data = [headers, ...cleanRows];

  // 2. Build worksheet
  const ws = XLSX.utils.aoa_to_sheet(data);

  // 3. Mark cells as explicit String type ('s') and Text format ('@')
  const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
      const cell = ws[cellAddress];
      if (cell) {
        cell.t = "s";
        cell.z = "@";
      }
    }
  }

  // 4. Calculate responsive column widths
  const colWidths = headers.map((h, i) => {
    let maxLen = h.length;
    cleanRows.forEach((r) => {
      const val = r[i] || "";
      if (val.length > maxLen) maxLen = val.length;
    });
    return { wch: Math.min(Math.max(maxLen + 4, 14), 50) };
  });
  ws["!cols"] = colWidths;

  // 5. Append sheet to workbook and trigger browser download
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 31));

  const cleanFilename = filename.toLowerCase().endsWith(".xlsx")
    ? filename
    : `${filename.replace(/\.csv$/i, "")}.xlsx`;

  XLSX.writeFile(wb, cleanFilename);
}

/**
 * Fallback CSV export with UTF-8 BOM and explicit text formula quoting (="...")
 * so Excel does not convert phone numbers into scientific notation (9.18E+11).
 */
export function exportToCsv({
  filename,
  headers,
  rows,
  phoneColIndices,
  phoneColumnIndices,
}: ExportOptions) {
  if (!rows || rows.length === 0) {
    throw new Error("No data available to export.");
  }

  const resolvedPhoneCols = phoneColIndices || phoneColumnIndices || [0];

  const csvRows = rows.map((row) =>
    row
      .map((cell, colIdx) => {
        if (cell === null || cell === undefined) return '""';
        let strVal = String(cell).replace(/"/g, '""');
        // If it is a phone column, format with text formula ="..." so Excel displays digits as text
        if (resolvedPhoneCols.includes(colIdx) && /^\+?[0-9]{7,}$/.test(strVal)) {
          return `="${strVal}"`;
        }
        return `"${strVal}"`;
      })
      .join(",")
  );

  // Prepend UTF-8 BOM (\uFEFF)
  const csvString = "\uFEFF" + [headers.map((h) => `"${h}"`).join(","), ...csvRows].join("\r\n");
  const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.toLowerCase().endsWith(".csv") ? filename : `${filename}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
