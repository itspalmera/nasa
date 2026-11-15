from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple, Any
import math
import json

# 1. DOMINIOS FÍSICOS OFICIALES (Escala de Normalización 0 a 1)
PHYSICAL_DOMAINS = {
    "o2": {"min": 10.0, "max": 100.0, "unit": "% molar O2", "weight": 0.35},
    "pressure": {"min": 20.0, "max": 304.0, "unit": "kPa", "weight": 0.20},
    "flow": {"min": 0.0, "max": 55.0, "unit": "cm/s", "weight": 0.30},
    "gravity": {"min": 0.0, "max": 1.0, "unit": "g", "weight": 0.15},
}

BASIS_CONFIDENCE = {
    "medido": 1.0,
    "planificado": 0.75,
    "sin_dato": 0.0,
    None: 0.0
}



def classify_intra_variable_scale(delta_norm: Optional[float], basis: str = "medido") -> Dict[str, Any]:
    """
    Clasifica una variable dentro de un experimento en la Escala Ordinal de 5 Niveles.
    """
    if delta_norm is None or basis == "sin_dato":
        return {
            "level": 0,
            "code": "UNREPORTED",
            "label": "Sin Dato en Ficha (Pendiente PSI)",
            "normalized_spread": None
        }
    if delta_norm == 0.0:
        return {
            "level": 1,
            "code": "FIXED_CONTROL",
            "label": "Condición Fija Estricta (Controlada)",
            "normalized_spread": 0.0
        }
    if delta_norm <= 0.030:
        return {
            "level": 2,
            "code": "QUASI_FIXED",
            "label": "Cuasi-Fija (Fluctuación Operacional de Cabina)",
            "normalized_spread": round(delta_norm, 4)
        }
    if delta_norm <= 0.250:
        return {
            "level": 3,
            "code": "ITERATED_FOCUSED",
            "label": "Variable Iterada (Barrido Acotado de Frontera)",
            "normalized_spread": round(delta_norm, 4)
        }
    return {
        "level": 4,
        "code": "ITERATED_WIDE",
        "label": "Variable Iterada Dominante (Barrido de Amplio Espectro)",
        "normalized_spread": round(delta_norm, 4)
    }








def analyze_intra_investigation(inv: Dict[str, Any], max_fuels_catalog: int = 6) -> Dict[str, Any]:
    """
    MOTOR 3 - MODO INTRA-INVESTIGACIÓN:
    Separa algorítmicamente Variables Fijas, Cuasi-Fijas, Iteradas y Efectos Medidos.
    """
    fixed_conditions = []
    iterated_variables = []
    unreported_variables = []

    # A. Evaluar variables físicas de intervalo (o2, pressure, flow)
    for var_key in ["o2", "pressure", "flow"]:
        var_obj = inv.get(var_key, {})
        v_min = var_obj.get("min")
        v_max = var_obj.get("max")
        basis = var_obj.get("basis", "sin_dato")
        dom = PHYSICAL_DOMAINS[var_key]
        dom_range = dom["max"] - dom["min"]

        if v_min is None or v_max is None:
            scale_info = classify_intra_variable_scale(None, "sin_dato")
            unreported_variables.append({
                "variable": var_key,
                "unit": dom["unit"],
                "note": var_obj.get("note"),
                **scale_info
            })
        else:
            delta_abs = max(0.0, float(v_max) - float(v_min))
            delta_norm = min(1.0, delta_abs / dom_range)
            scale_info = classify_intra_variable_scale(delta_norm, basis)
            entry = {
                "variable": var_key,
                "min": v_min,
                "max": v_max,
                "delta_abs": round(delta_abs, 3),
                "unit": dom["unit"],
                "basis": basis,
                "note": var_obj.get("note"),
                **scale_info
            }
            if scale_info["level"] in (1, 2):
                fixed_conditions.append(entry)
            else:
                iterated_variables.append(entry)

    # B. Evaluar Gravedad (escalar fijo por plataforma en el JSON actual)
    g_val = inv.get("gravity")
    if g_val is not None:
        fixed_conditions.append({
            "variable": "gravity",
            "min": g_val,
            "max": g_val,
            "delta_abs": 0.0,
            "unit": "g",
            "basis": "medido",
            **classify_intra_variable_scale(0.0, "medido")
        })

    # C. Evaluar Combustibles (Conjunto Nominal)
    fuels = inv.get("fuels", [])
    if len(fuels) == 0:
        unreported_variables.append({
            "variable": "fuels",
            **classify_intra_variable_scale(None, "sin_dato")
        })
    elif len(fuels) == 1:
        fixed_conditions.append({
            "variable": "fuels",
            "values": fuels,
            "count": 1,
            **classify_intra_variable_scale(0.0, "medido")
        })
    else:
        fuel_spread = min(1.0, (len(fuels) - 1) / max(1, max_fuels_catalog - 1))
        iterated_variables.append({
            "variable": "fuels",
            "values": fuels,
            "count": len(fuels),
            **classify_intra_variable_scale(fuel_spread, "medido")
        })

    # D. Hardware y Plataforma (Siempre Condiciones de Contorno Fijas del Experimento)
    fixed_conditions.append({
        "variable": "hardware_context",
        "platform": inv.get("platform"),
        "facility": inv.get("facility"),
        "hardware": inv.get("hardware"),
        "fuel_phase": inv.get("fuel_phase"),
        "level": 1,
        "code": "FIXED_CONTROL",
        "label": "Arquitectura de Hardware Fija"
    })

    # Ordenar variables iteradas por impacto (mayor dispersión normalizada primero)
    iterated_variables.sort(key=lambda x: x.get("normalized_spread") or 0.0, reverse=True)

    return {
        "investigation_id": inv.get("id"),
        "acronym": inv.get("acronym"),
        "fixed_conditions": fixed_conditions,
        "iterated_variables": iterated_variables,
        "unreported_variables": unreported_variables,
        "declared_variables_text": inv.get("variables"),
        "diagnostics_used": inv.get("diagnostics", []),
        "measured_outcomes": inv.get("findings", [])
    }






def dice_similarity(set_a: List[str], set_b: List[str]) -> float:
    """Coeficiente de Dice-Sørensen en [0, 1] para listas categóricas."""
    a = {s.strip().lower() for s in (set_a or []) if s}
    b = {s.strip().lower() for s in (set_b or []) if s}
    if not a and not b:
        return 0.0
    return (2.0 * len(a & b)) / (len(a) + len(b))






def interval_similarity(min_a: float, max_a: float, min_b: float, max_b: float, dom_range: float) -> float:
    """
    Similitud de intervalos combinando Proximidad (65%) y Solapamiento IoU (35%).
    """
    gap = max(0.0, max(min_a, min_b) - min(max_a, max_b))
    s_prox = max(0.0, 1.0 - (gap / dom_range))

    inter = max(0.0, min(max_a, max_b) - max(min_a, min_b))
    span = max(max_a, max_b) - min(min_a, min_b)
    if span == 0.0:
        s_over = 1.0 if min_a == min_b else 0.0
    else:
        s_over = inter / span

    return 0.65 * s_prox + 0.35 * s_over





def compare_inter_investigations(inv_a: Dict[str, Any], inv_b: Dict[str, Any]) -> Dict[str, Any]:
    """
    MOTOR 3 - MODO INTER-INVESTIGACIÓN (Cara a Cara):
    Calcula Similitud de Gower Generalizada y clasifica la relación taxonómica.
    """
    # 1. Sub-índice Ambiental / Termodinámico (S_env)
    env_num = 0.0
    env_den = 0.0
    env_breakdown = {}
    completeness_scores = []

    for k in ["o2", "pressure", "flow"]:
        dom = PHYSICAL_DOMAINS[k]
        w = dom["weight"]
        obj_a = inv_a.get(k, {})
        obj_b = inv_b.get(k, {})
        if (obj_a.get("min") is not None and obj_a.get("max") is not None and
            obj_b.get("min") is not None and obj_b.get("max") is not None):
            sim_k = interval_similarity(
                float(obj_a["min"]), float(obj_a["max"]),
                float(obj_b["min"]), float(obj_b["max"]),
                dom["max"] - dom["min"]
            )
            env_num += w * sim_k
            env_den += w
            env_breakdown[k] = round(sim_k, 3)
            c_a = BASIS_CONFIDENCE.get(obj_a.get("basis"), 0.5)
            c_b = BASIS_CONFIDENCE.get(obj_b.get("basis"), 0.5)
            completeness_scores.append(0.5 * (c_a + c_b))
        else:
            env_breakdown[k] = None
            completeness_scores.append(0.0)

    # Gravedad
    ga, gb = inv_a.get("gravity"), inv_b.get("gravity")
    if ga is not None and gb is not None:
        sim_g = 1.0 - abs(float(ga) - float(gb)) / 1.0
        w_g = PHYSICAL_DOMAINS["gravity"]["weight"]
        env_num += w_g * sim_g
        env_den += w_g
        env_breakdown["gravity"] = round(sim_g, 3)
        completeness_scores.append(1.0)

    s_env = (env_num / env_den) if env_den > 0 else 0.0

    # 2. Sub-índice de Homología Instrumental y Hardware (S_hw)
    same_platform = 1.0 if (inv_a.get("platform") and inv_a.get("platform") == inv_b.get("platform")) else 0.0
    same_facility = 1.0 if (inv_a.get("facility") and inv_a.get("facility") == inv_b.get("facility")) else 0.0
    same_hardware = 1.0 if (inv_a.get("hardware") and inv_a.get("hardware") == inv_b.get("hardware")) else 0.0
    s_hw_tree = 0.20 * same_platform + 0.35 * same_facility + 0.45 * same_hardware
    s_diag = dice_similarity(inv_a.get("diagnostics", []), inv_b.get("diagnostics", []))
    s_hw = 0.60 * s_hw_tree + 0.40 * s_diag

    # 3. Sub-índice de Combustible y Pilar de Seguridad (S_fuel)
    same_phase = 1.0 if (inv_a.get("fuel_phase") and inv_a.get("fuel_phase") == inv_b.get("fuel_phase")) else 0.0
    s_fuels_set = dice_similarity(inv_a.get("fuels", []), inv_b.get("fuels", []))
    s_pillars = dice_similarity(inv_a.get("pillars", []), inv_b.get("pillars", []))
    s_fuel = 0.40 * same_phase + 0.35 * s_fuels_set + 0.25 * s_pillars

    # Score Global Compuesto en [0, 1]
    s_total = 0.40 * s_env + 0.30 * s_hw + 0.30 * s_fuel
    confidence = sum(completeness_scores) / len(completeness_scores)

    # Clasificación Taxonómica en 4 Clases
    if s_hw >= 0.65 and s_fuel >= 0.60:
        tax_class = "SEQUENTIAL_EVOLUTION"
        tax_label = "Clase I: Evolución Secuencial / Misma Familia Experimental"
    elif s_env >= 0.60 and same_phase == 0.0 and s_pillars > 0.0:
        tax_class = "CROSS_PHASE_ANALOG"
        tax_label = "Clase II: Emulación Cruzada / Análogo Físico entre Fases"
    elif s_hw >= 0.50 and s_fuel < 0.50:
        tax_class = "HARDWARE_REUSE_CALIBRATION"
        tax_label = "Clase III: Reutilización Instrumental / Calibración Cruzada"
    else:
        tax_class = "ORTHOGONAL_REGIMES"
        tax_label = "Clase IV: Regímenes Físicos Divergentes y Complementarios"

    return {
        "pair": [inv_a.get("acronym"), inv_b.get("acronym")],
        "similarity_scores": {
            "total_gower_score": round(s_total, 3),
            "environmental_similarity": round(s_env, 3),
            "hardware_homology": round(s_hw, 3),
            "fuel_and_pillar_similarity": round(s_fuel, 3),
            "data_completeness_confidence": round(confidence, 3)
        },
        "taxonomy": {
            "class_code": tax_class,
            "class_label": tax_label
        },
        "env_variable_breakdown": env_breakdown,
        "set_intersections": {
            "shared_pillars": list(set(inv_a.get("pillars", [])) & set(inv_b.get("pillars", []))),
            "shared_fuels": list(set(inv_a.get("fuels", [])) & set(inv_b.get("fuels", []))),
            "shared_diagnostics": list(set(inv_a.get("diagnostics", [])) & set(inv_b.get("diagnostics", []))),
            "shared_facility": inv_a.get("facility") if same_facility else None
        }
    }

