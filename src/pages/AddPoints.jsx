import { useRef, useState } from 'react';
import { api } from '../api';

// The points team's only page: add points to students by MI number, either one
// at a time or from a CSV of (MI number, points). Nothing else is shown here —
// no registrations, totals or exports. The backend enforces the same limits
// (see admin_points.controller.js); these checks only catch mistakes early.

const MAX_POINTS = 500;
// Rows per request. The backend accepts 500 and the JSON body limit is 30kb.
const CHUNK_SIZE = 400;

const normalizeMiNo = (value) => String(value ?? '').trim().toUpperCase();

const parsePoints = (value) => {
  const text = String(value ?? '').trim();
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
};

// Splits one CSV line, honouring double-quoted cells ("a, b" stays one cell).
const splitCsvLine = (line) => {
  const cells = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cell += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',' || ch === ';' || ch === '\t') { cells.push(cell); cell = ''; }
    else cell += ch;
  }
  cells.push(cell);
  return cells.map((c) => c.trim());
};

// Reads the CSV into rows of { line, mi_no, points, error }. A header row is
// optional: if present, the columns are found by name ("mi…" and "point…"),
// otherwise the first column is the MI number and the second the points.
const parseCsv = (text) => {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/);
  const nonEmpty = lines
    .map((raw, i) => ({ cells: splitCsvLine(raw), line: i + 1 }))
    .filter(({ cells }) => cells.some((c) => c !== ''));

  if (nonEmpty.length === 0) return [];

  let miCol = 0;
  let ptsCol = 1;
  let start = 0;
  const first = nonEmpty[0].cells.map((c) => c.toLowerCase());
  const looksLikeHeader = parsePoints(nonEmpty[0].cells[1]) === null
    && first.some((c) => c.includes('point'));
  if (looksLikeHeader) {
    const mi = first.findIndex((c) => c.includes('mi'));
    const pts = first.findIndex((c) => c.includes('point'));
    if (mi !== -1) miCol = mi;
    if (pts !== -1) ptsCol = pts;
    start = 1;
  }

  return nonEmpty.slice(start).map(({ cells, line }) => {
    const mi_no = normalizeMiNo(cells[miCol]);
    const points = parsePoints(cells[ptsCol]);
    let error = null;
    if (!mi_no) error = 'MI number is missing';
    else if (points === null || points <= 0) error = 'Points must be a whole number above 0';
    else if (points > MAX_POINTS) error = `Over the ${MAX_POINTS} limit`;
    return { line, mi_no, points, error };
  });
};

// Sums repeats of one MI number so the per-person limit holds across the file.
const aggregate = (rows) => {
  const totals = new Map();
  for (const row of rows) {
    if (row.error) continue;
    totals.set(row.mi_no, (totals.get(row.mi_no) ?? 0) + row.points);
  }
  return totals;
};

const downloadTemplate = () => {
  const blob = new Blob(['mi_no,points\nMI-ABC-0001,100\n'], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'points_template.csv';
  a.click();
  URL.revokeObjectURL(url);
};

const inputClass =
  'w-full bg-white/[0.04] border border-white/[0.08] rounded-xl px-4 py-2.5 text-sm text-white placeholder-slate-600 focus:outline-none focus:border-emerald-500/50';

const buttonClass =
  'px-5 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-40 disabled:cursor-not-allowed';

function Card({ title, subtitle, children }) {
  return (
    <div className="bg-[#111118] border border-white/[0.07] rounded-2xl p-6">
      <h3 className="text-white font-semibold">{title}</h3>
      {subtitle && <p className="text-xs text-slate-500 mt-1 mb-5">{subtitle}</p>}
      {children}
    </div>
  );
}

function ResultSummary({ result }) {
  if (!result) return null;
  const { awarded, notFound, failed, error, invalid } = result;
  return (
    <div className="mt-5 space-y-3 text-sm">
      {error && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
          {error}
          {invalid?.length > 0 && (
            <ul className="mt-2 text-xs space-y-0.5">
              {invalid.slice(0, 20).map((r, i) => (
                <li key={i}>{r.mi_no || '(blank)'} — {r.reason}</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {awarded?.length > 0 && (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-emerald-300">
          Added points to {awarded.length} student(s)
          {awarded.length <= 10 && (
            <ul className="mt-2 text-xs space-y-0.5 text-emerald-200/80">
              {awarded.map((r) => (
                <li key={r.mi_no}>+{r.points} → {r.mi_no} ({r.full_name})</li>
              ))}
            </ul>
          )}
        </div>
      )}
      {notFound?.length > 0 && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-amber-300">
          No student found for {notFound.length} MI number(s) — nothing added for these:
          <p className="mt-1 text-xs text-amber-200/80 break-words">
            {notFound.map((r) => r.mi_no).join(', ')}
          </p>
        </div>
      )}
      {failed?.length > 0 && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-red-300">
          Failed for {failed.length} MI number(s):
          <p className="mt-1 text-xs break-words">
            {failed.map((r) => `${r.mi_no} (${r.reason})`).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

function ManualForm() {
  const [miNo, setMiNo] = useState('');
  const [points, setPoints] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const parsed = parsePoints(points);
  const valid = normalizeMiNo(miNo) && parsed !== null && parsed > 0 && parsed <= MAX_POINTS;

  const submit = async (e) => {
    e.preventDefault();
    if (!valid || busy) return;
    const mi = normalizeMiNo(miNo);
    if (!window.confirm(`Add ${parsed} points to ${mi}?`)) return;
    setBusy(true);
    setResult(null);
    try {
      const data = await api.awardPoints([{ mi_no: mi, points: parsed }], 'manual');
      setResult(data);
      if (data.awarded?.length) { setMiNo(''); setPoints(''); }
    } catch (err) {
      setResult({ error: err.message, invalid: err.invalid });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Add manually" subtitle={`One student at a time. Up to ${MAX_POINTS} points per entry.`}>
      <form onSubmit={submit} className="space-y-3">
        <input
          className={inputClass}
          placeholder="MI number (e.g. MI-ABC-0001)"
          value={miNo}
          onChange={(e) => setMiNo(e.target.value)}
        />
        <input
          className={inputClass}
          placeholder={`Points (1–${MAX_POINTS})`}
          inputMode="numeric"
          value={points}
          onChange={(e) => setPoints(e.target.value)}
        />
        {points && parsed !== null && parsed > MAX_POINTS && (
          <p className="text-xs text-red-400">Max {MAX_POINTS} points at a time.</p>
        )}
        <button type="submit" className={buttonClass} disabled={!valid || busy}>
          {busy ? 'Adding…' : 'Add points'}
        </button>
      </form>
      <ResultSummary result={result} />
    </Card>
  );
}

function CsvUpload() {
  const fileRef = useRef(null);
  const [fileName, setFileName] = useState('');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');
  const [result, setResult] = useState(null);

  const totals = aggregate(rows);
  const rowErrors = rows.filter((r) => r.error);
  const overLimit = [...totals].filter(([, pts]) => pts > MAX_POINTS);
  const canSubmit = rows.length > 0 && rowErrors.length === 0 && overLimit.length === 0 && !busy;
  const totalPoints = [...totals.values()].reduce((a, b) => a + b, 0);

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    setResult(null);
    if (!file) { setRows([]); setFileName(''); return; }
    setFileName(file.name);
    setRows(parseCsv(await file.text()));
  };

  const reset = () => {
    setRows([]);
    setFileName('');
    if (fileRef.current) fileRef.current.value = '';
  };

  const submit = async () => {
    if (!canSubmit) return;
    if (!window.confirm(`Add ${totalPoints} points across ${totals.size} student(s)?`)) return;

    const entries = [...totals].map(([mi_no, points]) => ({ mi_no, points }));
    const combined = { awarded: [], notFound: [], failed: [] };
    setBusy(true);
    setResult(null);
    try {
      for (let i = 0; i < entries.length; i += CHUNK_SIZE) {
        setProgress(`${Math.min(i + CHUNK_SIZE, entries.length)} / ${entries.length}`);
        const data = await api.awardPoints(entries.slice(i, i + CHUNK_SIZE), 'csv');
        combined.awarded.push(...(data.awarded ?? []));
        combined.notFound.push(...(data.notFound ?? []));
        combined.failed.push(...(data.failed ?? []));
      }
      setResult(combined);
      reset();
    } catch (err) {
      // Earlier chunks have already been added; say so rather than hiding it.
      const done = combined.awarded.length;
      setResult({
        ...combined,
        error: `${err.message}${done ? ` — stopped after adding points to ${done} student(s); do not re-upload those rows` : ''}`,
        invalid: err.invalid,
      });
    } finally {
      setBusy(false);
      setProgress('');
    }
  };

  return (
    <Card
      title="Upload CSV"
      subtitle={`Two columns: MI number and points. Max ${MAX_POINTS} points per person per upload (repeats are added up).`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <label className="px-4 py-2.5 rounded-xl text-sm font-medium bg-white/[0.06] border border-white/[0.08] text-slate-200 cursor-pointer hover:bg-white/[0.1] transition">
          Choose CSV
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
        </label>
        <span className="text-xs text-slate-500 truncate max-w-[200px]">{fileName || 'No file chosen'}</span>
        <button type="button" onClick={downloadTemplate} className="text-xs text-emerald-400 hover:underline ml-auto">
          Download template
        </button>
      </div>

      {rows.length > 0 && (
        <div className="mt-5 space-y-3">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] py-3">
              <p className="text-lg font-bold text-white">{rows.length}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Rows</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] py-3">
              <p className="text-lg font-bold text-white">{totals.size}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Students</p>
            </div>
            <div className="rounded-xl bg-white/[0.03] border border-white/[0.06] py-3">
              <p className="text-lg font-bold text-emerald-300">{totalPoints}</p>
              <p className="text-[10px] text-slate-500 uppercase tracking-wider">Points</p>
            </div>
          </div>

          {(rowErrors.length > 0 || overLimit.length > 0) && (
            <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              Fix these in the file and upload again — nothing will be added until it is clean:
              <ul className="mt-2 text-xs space-y-0.5 max-h-40 overflow-y-auto">
                {rowErrors.map((r) => (
                  <li key={`l${r.line}`}>Line {r.line}: {r.mi_no || '(blank)'} — {r.error}</li>
                ))}
                {overLimit.map(([mi, pts]) => (
                  <li key={`o${mi}`}>{mi}: {pts} points in total — over the {MAX_POINTS} limit</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="button" className={buttonClass} disabled={!canSubmit} onClick={submit}>
              {busy ? `Adding… ${progress}` : 'Add points'}
            </button>
            {!busy && (
              <button type="button" onClick={reset} className="text-xs text-slate-400 hover:text-white">
                Clear
              </button>
            )}
          </div>
        </div>
      )}

      <ResultSummary result={result} />
    </Card>
  );
}

export default function AddPoints() {
  return (
    <div className="grid gap-6 lg:grid-cols-2 max-w-5xl">
      <CsvUpload />
      <ManualForm />
    </div>
  );
}
