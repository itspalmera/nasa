"use client";

import {useT} from '../src/i18n/useT';
import { useEffect, useRef, useState } from "react";
import { Download } from "lucide-react";
import { useScenario } from "../src/context/ScenarioContext";
import OODPanel, { type InitialConditions } from "./ood/ood-panel";

export default function PredictAsk({
  initialConditions,
}: {
  initialConditions: InitialConditions;
}) {
  const t = useT();

  const {lang} = useScenario();
  const en = lang === "en";
  const tabLabels: Record<string, string> = {"Predict partial gravity": en ? "Estimate properties" : "Estimar propiedades", "Extract clean data": en ? "Download observations" : "Descargar observaciones"};
  const [tab, setTab] = useState("Predict partial gravity");
  // Token de la API (FLAME_API_TOKEN). Vacío salvo que el backend lo exija; el Copilot está en el paso 4.
  const [token] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  useEffect(() => {request.current?.abort(); setBusy(false); setError("");}, [lang]);

  async function downloadDataset() {
    setBusy(true);
    setError("");
    const controller = new AbortController();
    request.current = controller;
    try {
      const response = await fetch("/api/ood/dataset", {
        signal: controller.signal,
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        throw Error(data?.error?.message || "Observation dataset unavailable");
      }
      const url = URL.createObjectURL(await response.blob());
      const link = document.createElement("a");
      link.href = url;
      link.download = "combustion-observations.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      if (!controller.signal.aborted) setError((reason as Error).message);
    } finally {
      if (request.current === controller && !controller.signal.aborted)
        setBusy(false);
    }
  }

  return (
    <section className="sf-panel sf-predict" aria-label={t("Predict & Ask")}>
      <div className="sf-segments sf-view-tabs">
        {["Predict partial gravity", "Extract clean data"].map(
          (name) => (
            <button
              key={name}
              type="button"
              aria-pressed={tab === name}
              onClick={() => {
                setTab(name);
                setError("");
              }}
            >
              {t(tabLabels[name])}
            </button>
          ),
        )}
      </div>
      <p className="sf-footnote">
        {" "}{t("Predictions and evidence use the backend’s combustion-observations.json. Cohorts, units, review status and provenance are preserved. Experimental configurations are filtered by your scenario material.")}{" "}</p>
      <div hidden={tab !== "Predict partial gravity"}>
        <OODPanel token={token} initialConditions={initialConditions} />
      </div>
      {tab === "Extract clean data" && (
        <>
          <h2>{" "}{t("Export the observation dataset")}{" "}</h2>
          <p>
            {" "}{t("Download the exact dataset used by the prediction service, including citations, measurements, units and review flags. No scenario mock values are added.")}{" "}</p>
          <button
            className="sf-primary"
            disabled={busy}
            onClick={() => void downloadDataset()}
          >
            <Download size={16} />
            {t(busy ? "Downloading…" : "Download observations JSON")}
          </button>
        </>
      )}
      {error && (
        <div className="alert error" role="alert">
          {t(error)}
        </div>
      )}
    </section>
  );
}
