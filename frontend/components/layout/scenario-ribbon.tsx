"use client";
import {useT} from '../../src/i18n/useT';
import {useScenario} from "../../src/context/ScenarioContext";
import {MATERIALS_CATALOG} from "../../src/data/scenarioPresets";
import {HabitatPreset, ViewStep} from "../../models/flare.model";
export default function ScenarioRibbon({onEditScenario}: {habitat: HabitatPreset; activeStep: ViewStep; onEditScenario: () => void}) {
  const t = useT();

  const {lang, activeHabitat, conditions, selectedMaterial} = useScenario();
  return <div className="border-b border-slate-800 px-6 py-3 text-xs text-slate-300"><div className="mx-auto flex max-w-7xl flex-wrap items-center gap-3">
    <strong>{t(activeHabitat.name[lang])}</strong><span>{t(MATERIALS_CATALOG[selectedMaterial].name[lang])}</span>
    <span>{t(conditions.o2)}% O₂ · {t(conditions.pressurePsi)} {" "}{t("psi ·")}{" "}{t(conditions.airflowCms)} {" "}{t("cm/s ·")}{" "}{t(conditions.gravityG)} g</span>
    <button type="button" onClick={onEditScenario} className="text-sky-300 underline">{t(lang === "en" ? "Edit scenario" : "Editar escenario")}</button>
  </div></div>;
}
