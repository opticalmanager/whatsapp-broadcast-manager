"use client";

import React from "react";
import { Upload, FileSpreadsheet, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";

export default function ImportCsvPage() {
  return (
    <div className="space-y-6 max-w-4xl mx-auto select-none">
      <div className="border-b border-slate-200/80 dark:border-slate-800/80 pb-4">
        <h1 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">Import Customer CSV</h1>
        <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
          Upload external customer spreadsheets or offline store contact lists.
        </p>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 text-center space-y-4 shadow-xs">
        <div className="w-14 h-14 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center mx-auto">
          <FileSpreadsheet className="w-7 h-7" />
        </div>
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-slate-900 dark:text-white">Upload CSV or Excel File</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Supports CSV files containing Phone Numbers, Customer Names, and Prescription Tags.
          </p>
        </div>

        <button
          onClick={() => toast.success("Select a CSV file from your computer.")}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs border-none cursor-pointer shadow-xs inline-flex items-center gap-2"
        >
          <Upload className="w-4 h-4" />
          <span>Select CSV File</span>
        </button>
      </div>
    </div>
  );
}
