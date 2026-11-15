import {useT} from '../../i18n/useT';
import { useScenario } from "../../context/ScenarioContext";
import PredictAsk from "../../../app/predict-ask";

export const Step3PredictorView = () => {
  const t = useT();

  const { lang, conditions, selectedMaterial, setActiveStep } = useScenario();
  const en = lang === "en";
  const initialConditions = {
    material: selectedMaterial,
    gravity: conditions.gravityG, oxygen: conditions.o2,
    pressureKpa: conditions.pressurePsi * 6.894757293168, airflow: conditions.airflowCms,
  };
  return <section className="mx-auto max-w-[1440px] px-4 py-6 pb-20 sm:px-6">
    <span className="font-mono text-xs text-sky-300">03 · {t(en ? 'SCIENTIFIC PREDICTION' : 'PREDICCIÓN CIENTÍFICA')}</span>
    <h1 className="mt-2 text-3xl font-bold">{t(en ? "Go beyond what's tested" : "Ve más allá de lo probado")}</h1>
    <p className="mt-3 max-w-3xl text-sm text-slate-300">{t(en
      ? 'Fit models to source-linked combustion observations. The lab starts with your scenario; select an experimental configuration and inspect its supported properties.'
      : 'Ajusta modelos a observaciones de combustión con sus fuentes. El laboratorio parte de tu escenario: elige una configuración experimental y consulta las propiedades disponibles.')}</p>
    <p className="mt-2 text-sm text-amber-200">{t(en
      ? 'Estimates at untested gravities are unvalidated. The bundled observations await scientific review. No safety or extinction verdict is inferred.'
      : 'Las estimaciones en gravedades no probadas no están validadas. Las observaciones incluidas esperan revisión científica. No permiten determinar seguridad ni extinción.')}</p>
    <PredictAsk initialConditions={initialConditions}/>
    <button type="button" onClick={() => setActiveStep(2)} className="mt-6 rounded-lg border border-slate-700 px-5 py-3 text-sm">← {t(en ? 'Back to ranking' : 'Volver al ranking')}</button>
  </section>;
};
