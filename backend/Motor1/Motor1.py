#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyraScope SI - MOTOR 1: Mission-Matcher (Buscador y Rankeador por Misión)
======================================================================
Matemática Pura / Data Science: Calcula el Relevance Score (0-100%) y el
desglose de coincidencia por variable frente a un hábitat objetivo.
"""

from __future__ import annotations
import json
import math
from pathlib import Path
from typing import Any, Dict, List, Optional

# Dominios físicos oficiales para normalización (coincidentes con Motor 3)
PHYSICAL_DOMAINS: Dict[str, Dict[str, Any]] = {
    "o2": {"min": 10.0, "max": 100.0, "weight": 0.35, "unit": "% molar O2"},
    "pressure": {"min": 20.0, "max": 304.0, "weight": 0.20, "unit": "kPa"},
    "flow": {"min": 0.0, "max": 55.0, "weight": 0.30, "unit": "cm/s"},
    "gravity": {"min": 0.0, "max": 1.0, "weight": 0.15, "unit": "g"}
}

# Hábitats preconfigurados (Presets del Navbar Superior)
HABITAT_PRESETS: Dict[str, Dict[str, Any]] = {
    "lunar_base": {
        "name": "Base Lunar Artemis",
        "o2": 30.0,
        "pressure": 70.3,  # ~10.2 psi
        "flow": 10.0,
        "gravity": 0.167
    },
    "mars_habitat": {
        "name": "Hábitat Marciano",
        "o2": 28.0,
        "pressure": 55.0,
        "flow": 8.0,
        "gravity": 0.38
    },
    "iss_transit": {
        "name": "Estación ISS / Nave en Tránsito",
        "o2": 21.0,
        "pressure": 101.3, # 14.7 psi
        "flow": 10.0,
        "gravity": 0.0
    },
    "eva_suit": {
        "name": "Traje Espacial EVA",
        "o2": 100.0,
        "pressure": 29.6,  # 4.3 psi
        "flow": 5.0,
        "gravity": 0.0
    }
}

def calculate_mission_match(
    target_habitat: Dict[str, float],
    investigations_list: List[Dict[str, Any]],
    weights: Dict[str, float] = None,
    selected_pillar: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    MOTOR 1 (Mission-Matcher):
    Calcula la distancia euclidiana ponderada y el puntaje de relevancia (0-100%)
    de cada investigación de la NASA frente a las condiciones del hábitat objetivo.
    """
    if weights is None:
        weights = {k: v["weight"] for k, v in PHYSICAL_DOMAINS.items()}

    t_o2 = target_habitat.get("o2", 21.0)
    t_pressure = target_habitat.get("pressure", 101.3)
    t_flow = target_habitat.get("flow", 10.0)
    t_gravity = target_habitat.get("gravity", 0.0)

    results = []

    for inv in investigations_list:
        inv_o2 = inv.get("o2") or {}
        inv_pres = inv.get("pressure") or {}
        inv_flow = inv.get("flow") or {}

        # 1. Distancia de Oxígeno
        o2_min, o2_max = inv_o2.get("min"), inv_o2.get("max")
        if o2_min is not None and o2_max is not None:
            if o2_min <= t_o2 <= o2_max:
                dist_o2_norm = 0.0
                match_o2_pct = 100.0
            else:
                d = min(abs(t_o2 - o2_min), abs(t_o2 - o2_max))
                rng = PHYSICAL_DOMAINS["o2"]["max"] - PHYSICAL_DOMAINS["o2"]["min"]
                dist_o2_norm = d / rng
                match_o2_pct = max(0.0, 100.0 * (1.0 - dist_o2_norm))
        else:
            dist_o2_norm = 0.5
            match_o2_pct = 50.0

        # 2. Distancia de Presión
        p_min, p_max = inv_pres.get("min"), inv_pres.get("max")
        if p_min is not None and p_max is not None:
            if p_min <= t_pressure <= p_max:
                dist_p_norm = 0.0
                match_p_pct = 100.0
            else:
                d = min(abs(t_pressure - p_min), abs(t_pressure - p_max))
                rng = PHYSICAL_DOMAINS["pressure"]["max"] - PHYSICAL_DOMAINS["pressure"]["min"]
                dist_p_norm = d / rng
                match_p_pct = max(0.0, 100.0 * (1.0 - dist_p_norm))
        else:
            dist_p_norm = 0.5
            match_p_pct = 50.0

        # 3. Distancia de Flujo de aire
        f_min, f_max = inv_flow.get("min"), inv_flow.get("max")
        if f_min is not None and f_max is not None:
            if f_min <= t_flow <= f_max:
                dist_f_norm = 0.0
                match_f_pct = 100.0
            else:
                d = min(abs(t_flow - f_min), abs(t_flow - f_max))
                rng = PHYSICAL_DOMAINS["flow"]["max"] - PHYSICAL_DOMAINS["flow"]["min"]
                dist_f_norm = d / rng
                match_f_pct = max(0.0, 100.0 * (1.0 - dist_f_norm))
        else:
            dist_f_norm = 0.5
            match_f_pct = 50.0

        # 4. Distancia de Gravedad (Soporta gravedad emulada en E-FIELD)
        emulated_g = inv.get("emulated_gravity_g")
        g_val = inv.get("gravity", 0.0)
        if isinstance(emulated_g, dict) and emulated_g.get("representative") is not None:
            g_eff = emulated_g["representative"]
        else:
            g_eff = g_val if g_val is not None else 0.0

        rng_g = PHYSICAL_DOMAINS["gravity"]["max"] - PHYSICAL_DOMAINS["gravity"]["min"]
        dist_g_norm = abs(t_gravity - g_eff) / rng_g
        match_g_pct = max(0.0, 100.0 * (1.0 - dist_g_norm))

        # Distancia Euclidiana Ponderada
        weighted_sum_sq = (
            weights["o2"] * (dist_o2_norm ** 2) +
            weights["pressure"] * (dist_p_norm ** 2) +
            weights["flow"] * (dist_f_norm ** 2) +
            weights["gravity"] * (dist_g_norm ** 2)
        )
        weighted_euclidean_dist = math.sqrt(weighted_sum_sq)

        # Relevancia con decaimiento exponencial
        k_decay = 2.5
        relevance_raw = 100.0 * math.exp(-k_decay * weighted_euclidean_dist)

        # Bonificación por Pilar de Seguridad seleccionado
        pillar_bonus = 1.0
        inv_pillars = [p.lower() for p in inv.get("pillars", [])]
        if selected_pillar:
            if selected_pillar.lower() in inv_pillars:
                pillar_bonus = 1.15  # +15% boost
            else:
                pillar_bonus = 0.85  # -15% penalización leve

        final_score = round(min(100.0, max(0.0, relevance_raw * pillar_bonus)), 1)

        results.append({
            "investigation_id": inv.get("id"),
            "acronym": inv.get("acronym"),
            "name": inv.get("name"),
            "platform": inv.get("platform"),
            "facility": inv.get("facility"),
            "relevance_score": final_score,
            "match_breakdown": {
                "o2_match_pct": round(match_o2_pct, 1),
                "pressure_match_pct": round(match_p_pct, 1),
                "flow_match_pct": round(match_f_pct, 1),
                "gravity_match_pct": round(match_g_pct, 1)
            },
            "pillars": inv.get("pillars", []),
            "si_watermark": "SI-Generated Mission Ranking | Grounded in NASA PSI"
        })

    # Ordenar de mayor a menor puntaje de relevancia
    results.sort(key=lambda x: x["relevance_score"], reverse=True)
    return results

if __name__ == "__main__":
    db_path = Path("investigations_enriched.json") if Path("investigations_enriched.json").exists() else Path("investigations.json")
    with open(db_path, "r", encoding="utf-8") as f:
        db = json.load(f)

    investigations = db.get("investigations", [])

    print("=== TEST MOTOR 1: MISSION-MATCHER PARA BASE LUNAR ARTEMIS ===")
    lunar_target = HABITAT_PRESETS["lunar_base"]
    ranking = calculate_mission_match(lunar_target, investigations, selected_pillar="prevencion")

    for idx, item in enumerate(ranking[:5], 1):
        print(f"{idx}. {item['acronym']} ({item['name']}) -> Score: {item['relevance_score']}%")
        print(f"   Desglose: O2={item['match_breakdown']['o2_match_pct']}%, Presión={item['match_breakdown']['pressure_match_pct']}%, Gravedad={item['match_breakdown']['gravity_match_pct']}%")
    
    # Exportar salida JSON para el Frontend
    with open("motor1_test_output.json", "w", encoding="utf-8") as f:
        json.dump({"target_habitat": lunar_target, "ranking": ranking}, f, ensure_ascii=False, indent=2)
    print("\nReporte del Motor 1 exportado exitosamente en motor1_test_output.json")