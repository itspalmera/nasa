# -*- coding: utf-8 -*-
"""
FLAME - Motores 1 (Mission-Matcher) y 3 (Experimental Diff-Engine)
Integrados nativamente en backend/flame/ leyendo datasets/psi/investigations.json.
"""
from __future__ import annotations
from typing import Any, Dict, List, Optional
import json
import math
from pathlib import Path
from .config import ROOT

PHYSICAL_DOMAINS: Dict[str, Dict[str, Any]] = {
    "o2": {"min": 10.0, "max": 100.0, "weight": 0.35, "unit": "% molar O2"},
    "pressure": {"min": 20.0, "max": 304.0, "weight": 0.20, "unit": "kPa"},
    "flow": {"min": 0.0, "max": 55.0, "weight": 0.30, "unit": "cm/s"},
    "gravity": {"min": 0.0, "max": 1.0, "weight": 0.15, "unit": "g"},
}

BASIS_CONFIDENCE = {
    "medido": 1.0,
    "planificado": 0.75,
    "cabina": 0.70,
    "sin_dato": 0.0,
    None: 0.0,
}


def load_psi_catalog(store=None) -> Dict[str, Any]:
    """Catálogo para los motores 1 y 3: investigaciones (tabla investigations) y hábitats (tabla habitats_presets)
    desde Supabase cuando está configurado; si no, o si falla, datasets/psi/investigations.json."""
    if store is not None and hasattr(store.config, "catalog_dir"):
        try:
            from . import catalog
            cat, _ = catalog.load(Path(store.config.catalog_dir), store.config)
            if cat:
                presets, _origin = catalog.scenarios(Path(store.config.catalog_dir), store.config)
                habitats = [{"id": h["id"], "name": h["name"], "o2": h["o2_pct"], "pressure": h["pressure_kpa"],
                             "pressure_psi": h["pressure_psi"], "flow": h["flow_cms"], "gravity": h["gravity_g"],
                             "note": h.get("note")} for h in presets]
                return dict(cat, habitats=habitats or cat.get("habitats", []))
        except Exception:  # cualquier problema: se usa la lectura directa del JSON de abajo
            pass
    candidates = []
    if store is not None and hasattr(store.config, "catalog_dir"):
        candidates.append(Path(store.config.catalog_dir) / "investigations.json")
    candidates.extend([
        ROOT / "datasets" / "psi" / "investigations.json",
        ROOT / "data" / "investigations.json",
        ROOT / "scripts" / "investigations.json",
    ])
    for path in candidates:
        if path.exists():
            return json.loads(path.read_text(encoding="utf-8"))
    return {"investigations": [], "habitats": [], "sources": {}, "ground_studies": []}


# ==============================================================================
# MOTOR 1: MISSION-MATCHER (RANKING MULTICRITERIO TERMODINÁMICO)
# ==============================================================================
def calculate_mission_match(
    target_habitat: Dict[str, float],
    investigations_list: List[Dict[str, Any]],
    weights: Optional[Dict[str, float]] = None,
    selected_pillar: Optional[str] = None,
) -> List[Dict[str, Any]]:
    if weights is None:
        weights = {k: v["weight"] for k, v in PHYSICAL_DOMAINS.items()}

    t_o2 = float(target_habitat.get("o2", 21.0))
    t_pressure = float(target_habitat.get("pressure", 101.3))
    t_flow = float(target_habitat.get("flow", 10.0))
    t_gravity = float(target_habitat.get("gravity", 0.0))

    results = []
    for inv in investigations_list:
        inv_o2 = inv.get("o2") or {}
        inv_pres = inv.get("pressure") or {}
        inv_flow = inv.get("flow") or {}

        # 1. Distancia O2
        o2_min, o2_max = inv_o2.get("min"), inv_o2.get("max")
        if o2_min is not None and o2_max is not None:
            if o2_min <= t_o2 <= o2_max:
                dist_o2_norm, match_o2_pct = 0.0, 100.0
            else:
                d = min(abs(t_o2 - float(o2_min)), abs(t_o2 - float(o2_max)))
                dist_o2_norm = d / (PHYSICAL_DOMAINS["o2"]["max"] - PHYSICAL_DOMAINS["o2"]["min"])
                match_o2_pct = max(0.0, 100.0 * (1.0 - dist_o2_norm))
        else:
            dist_o2_norm, match_o2_pct = 0.35, 65.0

        # 2. Distancia Presión (kPa)
        p_min, p_max = inv_pres.get("min"), inv_pres.get("max")
        if p_min is not None and p_max is not None:
            if p_min <= t_pressure <= p_max:
                dist_p_norm, match_p_pct = 0.0, 100.0
            else:
                d = min(abs(t_pressure - float(p_min)), abs(t_pressure - float(p_max)))
                dist_p_norm = d / (PHYSICAL_DOMAINS["pressure"]["max"] - PHYSICAL_DOMAINS["pressure"]["min"])
                match_p_pct = max(0.0, 100.0 * (1.0 - dist_p_norm))
        else:
            dist_p_norm, match_p_pct = 0.35, 65.0

        # 3. Distancia Flujo (cm/s)
        f_min, f_max = inv_flow.get("min"), inv_flow.get("max")
        if f_min is not None and f_max is not None:
            if f_min <= t_flow <= f_max:
                dist_f_norm, match_f_pct = 0.0, 100.0
            else:
                d = min(abs(t_flow - float(f_min)), abs(t_flow - float(f_max)))
                dist_f_norm = d / (PHYSICAL_DOMAINS["flow"]["max"] - PHYSICAL_DOMAINS["flow"]["min"])
                match_f_pct = max(0.0, 100.0 * (1.0 - dist_f_norm))
        else:
            dist_f_norm, match_f_pct = 0.35, 65.0

        # 4. Distancia Gravedad (g) - considera gravedad emulada en E-FIELD
        emulated_g = inv.get("emulated_gravity_g")
        g_val = inv.get("gravity", 0.0)
        if isinstance(emulated_g, dict) and emulated_g.get("representative") is not None:
            g_eff = float(emulated_g["representative"])
        else:
            g_eff = float(g_val) if g_val is not None else 0.0

        dist_g_norm = abs(t_gravity - g_eff) / (PHYSICAL_DOMAINS["gravity"]["max"] - PHYSICAL_DOMAINS["gravity"]["min"])
        match_g_pct = max(0.0, 100.0 * (1.0 - dist_g_norm))

        weighted_sum_sq = (
            weights.get("o2", 0.35) * (dist_o2_norm ** 2)
            + weights.get("pressure", 0.20) * (dist_p_norm ** 2)
            + weights.get("flow", 0.30) * (dist_f_norm ** 2)
            + weights.get("gravity", 0.15) * (dist_g_norm ** 2)
        )
        relevance_raw = 100.0 * math.exp(-2.5 * math.sqrt(weighted_sum_sq))

        pillar_bonus = 1.0
        inv_pillars = [p.lower() for p in inv.get("pillars", [])]
        if selected_pillar and selected_pillar.lower() != "todos":
            pillar_bonus = 1.15 if selected_pillar.lower() in inv_pillars else 0.85

        final_score = round(min(100.0, max(0.0, relevance_raw * pillar_bonus)), 1)

        results.append({
            "investigation_id": inv.get("id"),
            "acronym": inv.get("acronym"),
            "name": inv.get("name"),
            "family": inv.get("family"),
            "platform": inv.get("platform"),
            "facility": inv.get("facility"),
            "hardware": inv.get("hardware"),
            "years": inv.get("years"),
            "in_psi": inv.get("in_psi"),
            "psi": inv.get("psi"),
            "fuel_phase": inv.get("fuel_phase"),
            "fuels": inv.get("fuels", []),
            "o2": inv_o2,
            "pressure": inv_pres,
            "flow": inv_flow,
            "gravity": inv.get("gravity"),
            "relevance_score": final_score,
            "match_breakdown": {
                "o2_match_pct": round(match_o2_pct, 1),
                "pressure_match_pct": round(match_p_pct, 1),
                "flow_match_pct": round(match_f_pct, 1),
                "gravity_match_pct": round(match_g_pct, 1),
            },
            "pillars": inv.get("pillars", []),
            "findings_count": len(inv.get("findings", [])),
            "objectives": inv.get("objectives"),
            "si_watermark": "SI-Generated Mission Ranking | Grounded in NASA PSI",
        })

    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results


# ==============================================================================
# MOTOR 3: EXPERIMENTAL DIFF-ENGINE (MODO INTRA E INTER-INVESTIGACIÓN)
# ==============================================================================
def classify_intra_variable_scale(delta_norm: Optional[float], basis: str = "medido") -> Dict[str, Any]:
    if delta_norm is None or basis == "sin_dato":
        return {"level": 0, "code": "UNREPORTED", "label": "Sin Dato en Ficha (Pendiente PSI)", "normalized_spread": None}
    if delta_norm == 0.0:
        return {"level": 1, "code": "FIXED_CONTROL", "label": "Condición Fija Estricta (Controlada)", "normalized_spread": 0.0}
    if delta_norm <= 0.030:
        return {"level": 2, "code": "QUASI_FIXED", "label": "Cuasi-Fija (Fluctuación Operacional de Cabina)", "normalized_spread": round(delta_norm, 4)}
    if delta_norm <= 0.250:
        return {"level": 3, "code": "ITERATED_FOCUSED", "label": "Variable Iterada (Barrido Acotado de Frontera)", "normalized_spread": round(delta_norm, 4)}
    return {"level": 4, "code": "ITERATED_WIDE", "label": "Variable Iterada Dominante (Barrido de Amplio Espectro)", "normalized_spread": round(delta_norm, 4)}


def analyze_intra_investigation(inv: Dict[str, Any], max_fuels_catalog: int = 6) -> Dict[str, Any]:
    fixed_conditions, iterated_variables, unreported_variables = [], [], []

    for var_key in ["o2", "pressure", "flow"]:
        var_obj = inv.get(var_key) or {}
        v_min, v_max = var_obj.get("min"), var_obj.get("max")
        basis = var_obj.get("basis", "sin_dato")
        dom = PHYSICAL_DOMAINS[var_key]
        dom_range = dom["max"] - dom["min"]

        if v_min is None and v_max is None:
            scale_info = classify_intra_variable_scale(None, "sin_dato")
            unreported_variables.append({"variable": var_key, "unit": dom["unit"], "note": var_obj.get("note"), **scale_info})
        else:
            lo = float(v_max if v_min is None else v_min)
            hi = float(v_min if v_max is None else v_max)
            delta_abs = max(0.0, hi - lo)
            delta_norm = min(1.0, delta_abs / dom_range)
            scale_info = classify_intra_variable_scale(delta_norm, basis)
            entry = {
                "variable": var_key, "min": lo, "max": hi, "delta_abs": round(delta_abs, 3),
                "unit": dom["unit"], "basis": basis, "note": var_obj.get("note"), **scale_info
            }
            if scale_info["level"] in (1, 2):
                fixed_conditions.append(entry)
            else:
                iterated_variables.append(entry)

    g_val = inv.get("gravity")
    if g_val is not None:
        fixed_conditions.append({
            "variable": "gravity", "min": g_val, "max": g_val, "delta_abs": 0.0,
            "unit": "g", "basis": "medido", **classify_intra_variable_scale(0.0, "medido")
        })

    fuels = inv.get("fuels", [])
    if len(fuels) == 0:
        unreported_variables.append({"variable": "fuels", **classify_intra_variable_scale(None, "sin_dato")})
    elif len(fuels) == 1:
        fixed_conditions.append({"variable": "fuels", "values": fuels, "count": 1, **classify_intra_variable_scale(0.0, "medido")})
    else:
        fuel_spread = min(1.0, (len(fuels) - 1) / max(1, max_fuels_catalog - 1))
        iterated_variables.append({"variable": "fuels", "values": fuels, "count": len(fuels), **classify_intra_variable_scale(fuel_spread, "medido")})

    fixed_conditions.append({
        "variable": "hardware_context", "platform": inv.get("platform"), "facility": inv.get("facility"),
        "hardware": inv.get("hardware"), "fuel_phase": inv.get("fuel_phase"),
        "level": 1, "code": "FIXED_CONTROL", "label": "Arquitectura de Hardware Fija"
    })

    iterated_variables.sort(key=lambda x: x.get("normalized_spread") or 0.0, reverse=True)
    return {
        "investigation_id": inv.get("id"),
        "acronym": inv.get("acronym"),
        "name": inv.get("name"),
        "fixed_conditions": fixed_conditions,
        "iterated_variables": iterated_variables,
        "unreported_variables": unreported_variables,
        "declared_variables_text": inv.get("variables"),
        "diagnostics_used": inv.get("diagnostics", []),
        "measured_outcomes": inv.get("findings", []),
    }


def dice_similarity(set_a: List[str], set_b: List[str]) -> float:
    a = {s.strip().lower() for s in (set_a or []) if s}
    b = {s.strip().lower() for s in (set_b or []) if s}
    if not a and not b:
        return 0.0
    return (2.0 * len(a & b)) / (len(a) + len(b))


def interval_similarity(min_a: float, max_a: float, min_b: float, max_b: float, dom_range: float) -> float:
    gap = max(0.0, max(min_a, min_b) - min(max_a, max_b))
    s_prox = max(0.0, 1.0 - (gap / dom_range))
    inter = max(0.0, min(max_a, max_b) - max(min_a, min_b))
    span = max(max_a, max_b) - min(min_a, min_b)
    s_over = (1.0 if min_a == min_b else 0.0) if span == 0.0 else (inter / span)
    return 0.65 * s_prox + 0.35 * s_over


def compare_inter_investigations(inv_a: Dict[str, Any], inv_b: Dict[str, Any]) -> Dict[str, Any]:
    env_num, env_den = 0.0, 0.0
    env_breakdown = {}
    completeness_scores = []

    for k in ["o2", "pressure", "flow"]:
        dom = PHYSICAL_DOMAINS[k]
        w = dom["weight"]
        obj_a, obj_b = inv_a.get(k) or {}, inv_b.get(k) or {}
        if obj_a.get("min") is not None and obj_b.get("min") is not None:
            a_min, a_max = float(obj_a["min"]), float(obj_a.get("max") or obj_a["min"])
            b_min, b_max = float(obj_b["min"]), float(obj_b.get("max") or obj_b["min"])
            sim_k = interval_similarity(a_min, a_max, b_min, b_max, dom["max"] - dom["min"])
            env_num += w * sim_k
            env_den += w
            env_breakdown[k] = round(sim_k, 3)
            c_a = BASIS_CONFIDENCE.get(obj_a.get("basis"), 0.5)
            c_b = BASIS_CONFIDENCE.get(obj_b.get("basis"), 0.5)
            completeness_scores.append(0.5 * (c_a + c_b))
        else:
            env_breakdown[k] = None
            completeness_scores.append(0.0)

    ga, gb = inv_a.get("gravity"), inv_b.get("gravity")
    if ga is not None and gb is not None:
        sim_g = 1.0 - abs(float(ga) - float(gb))
        w_g = PHYSICAL_DOMAINS["gravity"]["weight"]
        env_num += w_g * sim_g
        env_den += w_g
        env_breakdown["gravity"] = round(sim_g, 3)
        completeness_scores.append(1.0)

    s_env = (env_num / env_den) if env_den > 0 else 0.0
    same_platform = 1.0 if (inv_a.get("platform") and inv_a.get("platform") == inv_b.get("platform")) else 0.0
    same_facility = 1.0 if (inv_a.get("facility") and inv_a.get("facility") == inv_b.get("facility")) else 0.0
    same_hardware = 1.0 if (inv_a.get("hardware") and inv_a.get("hardware") == inv_b.get("hardware")) else 0.0
    s_hw_tree = 0.20 * same_platform + 0.35 * same_facility + 0.45 * same_hardware
    s_diag = dice_similarity(inv_a.get("diagnostics", []), inv_b.get("diagnostics", []))
    s_hw = 0.60 * s_hw_tree + 0.40 * s_diag

    same_phase = 1.0 if (inv_a.get("fuel_phase") and inv_a.get("fuel_phase") == inv_b.get("fuel_phase")) else 0.0
    s_fuels_set = dice_similarity(inv_a.get("fuels", []), inv_b.get("fuels", []))
    s_pillars = dice_similarity(inv_a.get("pillars", []), inv_b.get("pillars", []))
    s_fuel = 0.40 * same_phase + 0.35 * s_fuels_set + 0.25 * s_pillars

    s_total = 0.40 * s_env + 0.30 * s_hw + 0.30 * s_fuel
    confidence = sum(completeness_scores) / max(1, len(completeness_scores))

    if s_hw >= 0.65 and s_fuel >= 0.60:
        tax_class, tax_label = "SEQUENTIAL_EVOLUTION", "Clase I: Evolución Secuencial / Misma Familia Experimental"
    elif s_env >= 0.60 and same_phase == 0.0 and s_pillars > 0.0:
        tax_class, tax_label = "CROSS_PHASE_ANALOG", "Clase II: Emulación Cruzada / Análogo Físico entre Fases"
    elif s_hw >= 0.50 and s_fuel < 0.50:
        tax_class, tax_label = "HARDWARE_REUSE_CALIBRATION", "Clase III: Reutilización Instrumental / Calibración Cruzada"
    else:
        tax_class, tax_label = "ORTHOGONAL_REGIMES", "Clase IV: Regímenes Físicos Divergentes y Complementarios"

    return {
        "pair": [inv_a.get("acronym"), inv_b.get("acronym")],
        "details_a": analyze_intra_investigation(inv_a),
        "details_b": analyze_intra_investigation(inv_b),
        "similarity_scores": {
            "total_gower_score": round(s_total, 3),
            "environmental_similarity": round(s_env, 3),
            "hardware_homology": round(s_hw, 3),
            "fuel_and_pillar_similarity": round(s_fuel, 3),
            "data_completeness_confidence": round(confidence, 3),
        },
        "taxonomy": {"class_code": tax_class, "class_label": tax_label},
        "env_variable_breakdown": env_breakdown,
        "set_intersections": {
            "shared_pillars": list(set(inv_a.get("pillars", [])) & set(inv_b.get("pillars", []))),
            "shared_fuels": list(set(inv_a.get("fuels", [])) & set(inv_b.get("fuels", []))),
            "shared_diagnostics": list(set(inv_a.get("diagnostics", [])) & set(inv_b.get("diagnostics", []))),
            "shared_facility": inv_a.get("facility") if same_facility else None,
        },
    }