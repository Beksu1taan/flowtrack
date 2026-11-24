import { useState, useRef, useMemo } from "react";
import { Link } from "react-router-dom";
import { previewImport, commitImport } from "../services/api";
import { useTx } from "../context/TransactionsContext";
import { useLang } from "../context/LanguageContext";
import { money, dateLabel } from "../categories";
import CategorySelect from "../components/CategorySelect";
import CoachCard from "../components/CoachCard";

const BANKS = { kaspi: "Kaspi Gold", halyk: "Halyk Bank", jusan: "Jusan", excel: "Excel", csv: "CSV", other: "PDF" };

function Import() {
  const { reload } = useTx();
  const { t, lang } = useLang();
  const inputRef = useRef(null);

  const [stage, setStage] = useState("upload"); // upload | reading | review | saving | done
  const [error, setError] = useState("");
  const [drag, setDrag] = useState(false);
  const [preview, setPreview] = useState(null);
  const [rows, setRows] = useState([]);
  const [onlyOther, setOnlyOther] = useState(false);
  const [result, setResult] = useState(null);

  const handleFile = async (file) => {
    if (!file) return;
    setError("");
    setStage("reading");
    try {
      const data = await previewImport(file);
      setPreview(data);
      setRows(
        data.rows.map((r, i) => ({
          ...r,
          key: i,
          selected: !r.duplicate,
          originalCategory: r.category,
          remember: false,
        }))
      );
      setStage("review");
    } catch (e) {
      setError(e.message);
      setStage("upload");
    }
  };

  const update = (key, patch) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const changeCategory = (row, category) => {
   
    setRows((list) =>
      list.map((r) => {
        if (r.key === row.key) return { ...r, category, remember: category !== r.originalCategory };
        if (r.description === row.description && r.type === row.type && r.category === row.category) {
          return { ...r, category };
        }
        return r;
      })
    );
  };

  const visible = useMemo(
    () => (onlyOther ? rows.filter((r) => r.category === "other" || r.category === "other_income") : rows),
    [rows, onlyOther]
  );
  const selected = rows.filter((r) => r.selected);
  const sums = selected.reduce(
    (acc, r) => {
      acc[r.type] += r.amount;
      return acc;
    },
    { income: 0, expense: 0 }
  );
  const dupCount = rows.filter((r) => r.duplicate).length;
  const otherCount = rows.filter((r) => r.category === "other").length;

  const save = async () => {
    setStage("saving");
    setError("");
    try {
      const rules = [];
      const seen = new Set();
      rows.filter((r) => r.remember).forEach((r) => {
        if (!seen.has(r.description)) {
          seen.add(r.description);
          rules.push({ description: r.description, category: r.category });
        }
      });
      const res = await commitImport({
        bank: preview.bank,
        rows: selected.map(({ date, amount, type, description, category, hash }) => ({ date, amount, type, description, category, hash })),
        rules,
      });
      setResult(res);
      await reload();
      setStage("done");
    } catch (e) {
      setError(e.message);
      setStage("review");
    }
  };

  const reset = () => {
    setStage("upload");
    setPreview(null);
    setRows([]);
    setResult(null);
    setError("");
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div className="page">
      <div className="page-head">
        <h1>📥 {t("importTitle")}</h1>
        <span className="muted">{t("importSubtitle")}</span>
      </div>

      {error && <div className="box alert">{error}</div>}

      {(stage === "upload" || stage === "reading") && (
        <div
          className={`dropzone ${drag ? "drag" : ""} ${stage === "reading" ? "busy" : ""}`}
          onClick={() => stage === "upload" && inputRef.current.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDrag(false);
            if (stage === "upload") handleFile(e.dataTransfer.files[0]);
          }}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.csv,.txt,.xlsx"
            hidden
            onChange={(e) => handleFile(e.target.files[0])}
          />
          {stage === "reading" ? (
            <>
              <div className="spinner" />
              <p><b>{t("reading")}</b></p>
              <p className="muted small">{t("readingAi")}</p>
            </>
          ) : (
            <>
              <div className="empty-icon">📄</div>
              <p><b>{t("dropHere")}</b></p>
              <p className="muted small">PDF · CSV · XLSX</p>
              <p className="muted small hint">{t("dropHint")}</p>
            </>
          )}
        </div>
      )}

      {(stage === "review" || stage === "saving") && preview && (
        <>
          <div className="cards">
            <div className="card">
              <h3>{t("bank")}</h3>
              <p>{BANKS[preview.bank] || preview.bank}</p>
              {preview.aiUsed && <span className="chip chip-ai">🤖 {t("aiUsed")}</span>}
            </div>
            <div className="card">
              <h3>{t("period")}</h3>
              <p className="small-p">
                {dateLabel(preview.period.from, lang)} — {dateLabel(preview.period.to, lang)}
              </p>
            </div>
            <div className="card">
              <h3>{t("found")}</h3>
              <p>{rows.length}</p>
              {dupCount > 0 && <span className="muted small">{t("duplicates")}: {dupCount}</span>}
            </div>
            <div className="card">
              <h3>{t("income")} / {t("expense")}</h3>
              <p className="small-p">
                <span className="green">{money(sums.income)}</span> / <span className="red">{money(sums.expense)}</span>
              </p>
            </div>
          </div>

          <div className="box">
            <div className="toolbar">
              <label className="check">
                <input
                  type="checkbox"
                  checked={selected.length === rows.length}
                  onChange={(e) => setRows((list) => list.map((r) => ({ ...r, selected: e.target.checked })))}
                />
                {t("selectAll")}
              </label>
              <label className="check">
                <input type="checkbox" checked={onlyOther} onChange={(e) => setOnlyOther(e.target.checked)} />
                {t("onlyOther")} ({otherCount})
              </label>
              <span className="muted small grow">{t("rememberHint")}</span>
            </div>

            <div className="table-wrap">
              <table className="tx-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>{t("date")}</th>
                    <th>{t("description")}</th>
                    <th className="num">{t("amount")}</th>
                    <th>{t("category")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((r) => (
                    <tr key={r.key} className={r.selected ? "" : "off"}>
                      <td>
                        <input type="checkbox" checked={r.selected} onChange={(e) => update(r.key, { selected: e.target.checked })} />
                      </td>
                      <td className="nowrap">{dateLabel(r.date, lang)}</td>
                      <td>
                        {r.description}
                        {r.duplicate && <span className="chip chip-warn">{t("dup")}</span>}
                      </td>
                      <td className={`num nowrap ${r.type === "income" ? "green" : ""}`}>
                        {money(r.type === "income" ? r.amount : -r.amount, { sign: true })}
                      </td>
                      <td>
                        <div className="cat-cell">
                          <CategorySelect type={r.type} value={r.category} onChange={(c) => changeCategory(r, c)} />
                          {r.remember ? (
                            <label className="check small">
                              <input type="checkbox" checked={r.remember} onChange={(e) => update(r.key, { remember: e.target.checked })} />
                              {t("remember")}
                            </label>
                          ) : (
                            <span className={`src src-${r.categorySource}`}>{t("src_" + r.categorySource)}</span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="btn-row">
              <button onClick={save} disabled={!selected.length || stage === "saving"}>
                {stage === "saving" ? t("loading") : t("importConfirm", { count: selected.length })}
              </button>
              <button className="ghost" onClick={reset}>{t("cancel")}</button>
            </div>
          </div>
        </>
      )}

      {stage === "done" && result && (
        <>
          <div className="box success">
            <h2>✅ {t("importDone", { inserted: result.inserted })}</h2>
            {result.skipped > 0 && <p className="muted">{t("importSkipped", { skipped: result.skipped })}</p>}
            {result.rulesSaved > 0 && <p className="muted">{t("importRules", { rules: result.rulesSaved })}</p>}
            <div className="btn-row">
              <Link className="btn" to="/">{t("toDashboard")}</Link>
              <button className="ghost" onClick={reset}>{t("importAnother")}</button>
            </div>
          </div>
          <CoachCard />
        </>
      )}
    </div>
  );
}

export default Import;
