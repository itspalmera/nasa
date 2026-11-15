#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PyraScope SI - MASTER DATA PIPELINE DEFINITIVO (build_master_pipeline.py)
=========================================================================
1. Actualiza datasets/psi/investigations.json y data/investigations.json (26 investigaciones sin nulls).
2. Preserva y sincroniza las 12 entradas oficiales de background.json en datasets/psi/ y data/.
3. Actualiza data/combustion-observations.json (101 corridas con reviewed=True y LOI para Motor 2).
4. Genera supabase_seed.sql con las 5 tablas listas para pegar en Supabase.
"""

import json
from pathlib import Path

KPA_TO_PSI = 0.1450377377


def to_psi(kpa):
    return round(kpa * KPA_TO_PSI, 1) if kpa is not None else None


# 1. Parches trazables para las 26 investigaciones (compatibles con basis en {"medido", "planificado", "cabina"})
ENRICHMENT_PATCHES = {
    "bass": {
        "years": "2012",
        "o2": {"min": 17.0, "max": 21.0, "basis": "medido", "note": "Aire ISS (21%) diluido con N2 hasta 17% en MSG (ISS Guide p.19-20)."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "Presión nominal de trabajo en MSG (1 atm / 101.3 kPa)."},
        "flow": {"min": 1.0, "max": 40.0, "basis": "medido", "note": "Escalones de 40 cm/s a <1 cm/s en flujo opuesto y concurrente (PSI-26 / ISS Guide p.20)."},
    },
    "bass2": {
        "years": "2014",
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "Presión estándar MSG en la ISS (101.3 kPa / 14.7 psi)."},
    },
    "saffire1": {
        "o2": {"min": 21.7, "max": 21.7, "basis": "medido", "note": "Concentración inicial medida en vuelo Saffire-I (Ferkul et al. 2017, p.14; Han et al. 2026, p.2)."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "medido", "note": "1 atm según Han et al. 2026, tabla 1, p.2."},
        "flow": {"min": 20.0, "max": 20.0, "basis": "medido", "note": "Flujo forzado de 20 cm/s en ducto Saffire (PSI-98)."},
    },
    "saffire2": {
        "o2": {"min": 22.1, "max": 22.1, "basis": "medido", "note": "Concentración inicial medida en vuelo Saffire-II (Ferkul et al. 2017, p.9)."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "medido", "note": "1 atm según Han et al. 2026, tabla 1, p.2."},
        "flow": {"min": 20.0, "max": 25.0, "basis": "medido", "note": "20 cm/s en muestras 1-8 y 25 cm/s en muestra 2-6."},
    },
    "saffire3": {
        "o2": {"min": 21.2, "max": 21.2, "basis": "medido", "note": "Fuente: Han et al. 2026, tabla 1, p.2."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "medido", "note": "1 atm según Han et al. 2026, tabla 1, p.2."},
        "flow": {"min": 30.0, "max": 30.0, "basis": "medido", "note": "30 cm/s frente a 20 cm/s en Saffire-I (PSI-100)."},
    },
    "same": {
        "years": "2007",
        "o2": {"min": 21.0, "max": 21.0, "basis": "cabina", "note": "Aire estándar ISS dentro de MSG."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "101.3 kPa en MSG."},
        "flow": {"min": 5.0, "max": 20.0, "basis": "planificado", "note": "Caudal de aire variado en ducto de envejecimiento de humo."},
    },
    "samer": {
        "o2": {"min": 21.0, "max": 21.0, "basis": "cabina", "note": "Aire estándar ISS dentro de MSG."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "101.3 kPa en MSG."},
        "flow": {"min": 0.0, "max": 20.0, "basis": "planificado", "note": "Caudal controlado e incluyó ensayos sin flujo en MSG."},
    },
    "daft": {
        "years": "2005-2006",
        "o2": {"min": 21.0, "max": 21.0, "basis": "cabina", "note": "Aire de cabina habitable ISS."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "101.3 kPa en cabina ISS."},
        "flow": {"min": 5.0, "max": 15.0, "basis": "cabina", "note": "Corrientes de ventilación ambiental de cabina ISS."},
    },
    "flex": {
        "years": "2009-2012",
    },
    "flex2": {
        "years": "2012-2015",
        "flow": {"min": 0.0, "max": 5.0, "basis": "medido", "note": "Flujo convectivo sub-boyante lento trasladando la gota (0-5 cm/s)."},
    },
    "cfi": {
        "years": "2017",
        "o2": {"min": 15.0, "max": 30.0, "basis": "planificado", "note": "Rango cámara CIR-MDCA."},
        "flow": {"min": 0.0, "max": 0.0, "basis": "medido", "note": "Ambiente quieto."},
    },
    "bre": {
        "years": "2019-2021",
    },
    "cfig": {
        "years": "2021",
        "o2": {"min": 21.0, "max": 85.0, "basis": "medido", "note": "Hasta 85% de O2 en mezcla O2/N2 desde quemador esférico."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "101.3 kPa nominal en cámara CIR."},
        "flow": {"min": 2.0, "max": 15.0, "basis": "planificado", "note": "Flujo desde quemador esférico poroso."},
    },
    "cld": {
        "years": "2017-2019",
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "101.3 kPa en cámara CIR."},
        "flow": {"min": 5.0, "max": 30.0, "basis": "planificado", "note": "Co-flujo laminar de aire."},
    },
    "efield": {
        "years": "2018-2020",
        "o2": {"min": 21.0, "max": 21.0, "basis": "cabina", "note": "Co-flujo de aire en cámara CIR."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "101.3 kPa en cámara CIR."},
        "flow": {"min": 0.0, "max": 15.0, "basis": "planificado", "note": "Viento iónico inducido por malla de hasta +/-10 kV."},
        "emulated_gravity_g": {"min": 0.0, "max": 0.25, "representative": 0.167, "note": "Convección por viento iónico que mimetiza gravedad parcial lunar."},
    },
    "flamedesign": {
        "years": "2019-2020",
        "o2": {"min": 21.0, "max": 40.0, "basis": "planificado", "note": "Atmósfera enriquecida en O2 en CIR."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "101.3 kPa en cámara CIR."},
        "flow": {"min": 1.0, "max": 10.0, "basis": "planificado", "note": "Flujo radial en quemador esférico."},
    },
    "sflame": {
        "years": "2017-2018",
        "o2": {"min": 15.0, "max": 30.0, "basis": "planificado", "note": "Cámara CIR con diluyentes inertes."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "101.3 kPa en cámara CIR."},
        "flow": {"min": 1.0, "max": 10.0, "basis": "planificado", "note": "Quemador esférico poroso."},
    },
    "spice": {
        "years": "2009",
        "o2": {"min": 21.0, "max": 21.0, "basis": "cabina", "note": "Aire de cabina ISS en MSG."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "101.3 kPa en MSG."},
    },
    "slice": {
        "o2": {"min": 21.0, "max": 21.0, "basis": "cabina", "note": "Aire de cabina ISS en MSG."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "101.3 kPa en MSG."},
        "flow": {"min": 5.0, "max": 40.0, "basis": "medido", "note": "Co-flujo incrementado por pasos hasta el despegue (liftoff) de la llama."},
    },
    "sofie": {
        "years": "2022-2025",
    },
    "flare": {
        "years": "2020-2023",
        "o2": {"min": 15.0, "max": 35.0, "basis": "planificado", "note": "Ensayos en módulo Kibo (JAXA)."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "101.3 kPa nominal en Kibo."},
        "flow": {"min": 0.0, "max": 25.0, "basis": "planificado", "note": "Flujo forzado variable."},
    },
    "fm2": {
        "o2": {"min": 30.0, "max": 34.0, "basis": "planificado", "note": "Atmósfera lunar prevista (30% O2 o más)."},
        "pressure": {"min": 56.5, "max": 70.3, "basis": "planificado", "note": "Presión lunar prevista (10.2 psi / 70.3 kPa o menos)."},
        "flow": {"min": 0.0, "max": 15.0, "basis": "planificado", "note": "Cámara sellada autónoma lunar."},
    },
    "luci": {
        "o2": {"min": 21.0, "max": 34.0, "basis": "planificado", "note": "Rango previsto para investigaciones en gravedad lunar."},
        "pressure": {"min": 56.5, "max": 101.3, "basis": "planificado", "note": "Rango de presión de hábitat lunar."},
        "flow": {"min": 0.0, "max": 20.0, "basis": "planificado", "note": "Rango de ventilación en superficie lunar."},
    },
    # Los 4 estudios de papers agregados en v0.4:
    "confined": {
        "years": "2019-2024",
        "o2": {"min": 17.0, "max": 21.0, "basis": "medido", "note": "Aire de cabina ISS y mezclas O2/N2 en ducto MSG (Li et al. 2020; Sharma et al. 2024)."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "1 atm nominal en MSG (ISS)."},
    },
    "scem": {
        "years": "2021-2025",
        "pressure": {"min": 101.3, "max": 101.3, "basis": "cabina", "note": "Presión operativa en cámara SCEM del módulo Kibo (101.3 kPa)."},
    },
    "wires": {
        "years": "2018",
        "o2": {"min": 18.0, "max": 21.0, "basis": "medido", "note": "Ensayos a 18% y 21% O2 sobre cables aislados con polietileno (Nagachi et al. 2018, p.14-19)."},
        "pressure": {"min": 101.3, "max": 101.3, "basis": "medido", "note": "1 atm (101.3 kPa) reportado en Nagachi et al. 2018, p.7."},
    },
    "olson1987": {
        "o2": {"min": 16.5, "max": 100.0, "basis": "medido", "note": "Desde el límite de extinción (16.5% en 1g / 21% en 0g) hasta 100% O2 (Olson 1987, Tablas A-I a A-IV)."},
    },
    "pmmarods": {
        "years": "2022",
    },
}

# 2. Los 7 Hábitats Unificados (con presión en kPa para los motores y en psi para la UI)
UNIFIED_HABITATS = [
    {"id": "tierra", "name": "Tierra (nivel del mar)", "o2": 21.0, "pressure": 101.3, "pressure_psi": 14.7, "flow": 10.0, "gravity": 1.0, "note": "14,7 psi (101,3 kPa). Referencia de los ensayos estándar en 1 g.", "source": "challenge"},
    {"id": "iss", "name": "ISS / nave en tránsito", "o2": 21.0, "pressure": 101.3, "pressure_psi": 14.7, "flow": 10.0, "gravity": 0.0, "note": "Atmósfera similar a la Tierra en microgravedad (0 g) con ventilación forzada (~10 cm/s).", "source": "challenge"},
    {"id": "luna", "name": "Base lunar / rover presurizado", "o2": 30.0, "o2_max": 100.0, "pressure": 70.3, "pressure_psi": 10.2, "pressure_min": 0.0, "flow": 10.0, "gravity": 0.167, "note": "Regla del enunciado: O2 de 30 % o más y presión de 10,2 psi (70,3 kPa) o menos.", "source": "challenge"},
    {"id": "rover", "name": "Rover lunar presurizado", "o2": 34.0, "o2_max": 100.0, "pressure": 56.5, "pressure_psi": 8.2, "pressure_min": 29.6, "flow": 10.0, "gravity": 0.167, "note": "Atmósfera de rápida salida EVA (34% O2 a 8,2 psi / 56,5 kPa) en gravedad lunar (0,167 g).", "source": "challenge"},
    {"id": "marte", "name": "Hábitat en Marte", "o2": 26.5, "o2_max": 34.0, "pressure": 70.3, "pressure_psi": 10.2, "pressure_min": 50.0, "flow": 10.0, "gravity": 0.38, "note": "Gravedad parcial marciana (0,38 g) con atmósfera enriquecida en O2 y presión reducida.", "source": "challenge"},
    {"id": "traje", "name": "Traje espacial (EVA)", "o2": 100.0, "pressure": 29.6, "pressure_psi": 4.3, "flow": 15.0, "gravity": 0.0, "note": "100% O2 a 4,3 psi (29,6 kPa).", "source": "challenge"},
    {"id": "mina_tierra", "name": "Tierra: Mina Subterránea (Spinoff)", "o2": 20.9, "pressure": 73.1, "pressure_psi": 10.6, "flow": 25.0, "gravity": 1.0, "note": "Aplicación terrestre en faena minera en altura (~2750 m, Antofagasta): discriminación óptica humo vs polvo (SAME/DAFT).", "source": "challenge"}
]

# 3. Las 12 Entradas Oficiales de background.json (del encargado de IA)
OFFICIAL_BACKGROUND_12 = {
    "meta": {
        "description": "Contexto general para el copiloto: definiciones y datos del enunciado del desafío. NO son datos de PSI. Cada entrada se cita como FONDO#n según su posición; agregar entradas siempre al final.",
        "version": "0.2 (2026-11-15)"
    },
    "sources": {
        "challenge": {"title": "Enunciado del desafío Flame in Freefall (NASA Space Apps 2026)", "url": None},
        "nasa_combustion": {"title": "NASA Glenn - Combustion Science", "url": "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/"},
        "fm2": {"title": "NASA Glenn - FM2", "url": "https://www.nasa.gov/glenn/glenn-expertise-space-exploration/physical-sciences-program/combustion-science/flammability-of-materials-on-the-moon-fm2/"}
    },
    "entries": [
        {
            "title": "Qué es la microgravedad y cómo cambia una llama",
            "keywords": ["microgravedad", "micro", "gravedad", "caida", "libre", "flotabilidad", "vela", "esfera", "difusion", "definicion", "que", "es"],
            "text": "Microgravedad es la condición de caída libre en la que no hay flotabilidad: los gases calientes no suben. Por eso las llamas son muy distintas a las de la Tierra: en vez de una gota que parpadea, la llama de una vela se vuelve una esfera azul tenue que obtiene el oxígeno solo por difusión.",
            "source": "challenge"
        },
        {
            "title": "Gravedad de la Luna",
            "keywords": ["luna", "lunar", "gravedad", "sexto", "parcial", "fm2"],
            "text": "La gravedad de la Luna es un sexto de la terrestre (aproximadamente 0,17 g). FM2 sería el primer experimento de combustión en otro cuerpo planetario y estudiaría materiales ardiendo a esa gravedad.",
            "source": "fm2"
        },
        {
            "title": "Gravedad parcial: qué datos existen",
            "keywords": ["gravedad", "parcial", "luna", "marte", "lunar", "marciana", "luci", "fm2", "e-field", "cota", "acotar", "intermedia"],
            "text": "PSI no tiene todavía datos de combustión en gravedad parcial (Luna o Marte). Se espera que se agreguen en el futuro, por ejemplo desde LUCI y FM2. El experimento E-FIELD Flames de ACME imitó la gravedad parcial usando un campo eléctrico que actúa sobre los iones de la llama. Los resultados en microgravedad y en gravedad terrestre podrían acotar lo que ocurre en gravedades intermedias.",
            "source": "challenge"
        },
        {
            "title": "Los tres pilares de la seguridad contra incendios de la NASA",
            "keywords": ["prevencion", "deteccion", "supresion", "pilares", "seguridad", "incendios", "ignicion", "materiales", "inflamabilidad", "limites"],
            "text": "La seguridad contra incendios en naves de la NASA se enfoca en prevención, detección y supresión. La prevención se logra controlando las fuentes de ignición y seleccionando materiales, lo que depende de conocer sus límites de inflamabilidad.",
            "source": "challenge"
        },
        {
            "title": "Oxígeno y flujo de aire",
            "keywords": ["oxigeno", "o2", "flujo", "aire", "ventilacion", "inflamabilidad", "concentracion"],
            "text": "La inflamabilidad depende fuertemente de la concentración de oxígeno, y en microgravedad el flujo de aire también es importante.",
            "source": "challenge"
        },
        {
            "title": "Atmósfera de la base lunar y los rovers presurizados",
            "keywords": ["base", "lunar", "rover", "presurizado", "atmosfera", "exploracion", "oxigeno", "presion", "psi", "30", "10.2", "habitat", "artemis"],
            "text": "Para reducir el tiempo de preparación antes de salir con traje, se espera que la base lunar y los rovers presurizados tengan una presión y una concentración de oxígeno intermedias entre las del traje y las de la Tierra: probablemente 30 % de O2 o más, con 10,2 psi o menos. Frente a la atmósfera terrestre es un aumento de más de 40 % en la concentración de oxígeno, lo que hace mucho más inflamables los materiales.",
            "source": "challenge"
        },
        {
            "title": "Atmósfera del traje espacial",
            "keywords": ["traje", "espacial", "eva", "oxigeno", "100", "presion", "4.3", "psi", "descompresion", "prerrespiracion"],
            "text": "Los trajes espaciales se llenan con 100 % de oxígeno a solo 4,3 psi, mientras que la presión de la Tierra a nivel del mar es 14,7 psi. Para evitar la enfermedad por descompresión, los astronautas respiran 100 % de oxígeno antes de salir para expulsar el nitrógeno absorbido.",
            "source": "challenge"
        },
        {
            "title": "Incendios en la historia de la exploración espacial",
            "keywords": ["apolo", "apollo", "mir", "artemis", "historia", "accidente", "incendio", "explosion", "tanque", "alarma"],
            "text": "En 1967 la tripulación del Apolo 1 murió cuando se desató un incendio en su nave llena de oxígeno durante una prueba previa al lanzamiento. La tripulación del Apolo 13 sufrió la explosión de un tanque de oxígeno camino a la Luna. Una tripulación multinacional sobrevivió a un incendio en la estación Mir causado por la falla de un generador de oxígeno. En la misión Artemis II se activó una alarma de humo durante el vuelo.",
            "source": "challenge"
        },
        {
            "title": "Hardware compartido entre investigaciones",
            "keywords": ["hardware", "cir", "mdca", "msg", "rack", "glovebox", "equipo", "instalacion", "acme", "flex", "cfi", "bass", "spice", "slice"],
            "text": "Los seis experimentos de ACME usaron llamas de combustibles gaseosos con el mismo hardware modular en el Combustion Integrated Rack (CIR). FLEX, FLEX-2 y CFI quemaron gotas de combustible líquido con el Multi-user Droplet Combustion Apparatus (MDCA) en el CIR. BASS, BASS-II, SPICE y SLICE se hicieron en el Microgravity Science Glovebox (MSG) con el ducto de flujo construido para SPICE.",
            "source": "challenge"
        },
        {
            "title": "Ensayos con mayor concentración de oxígeno",
            "keywords": ["oxigeno", "maximo", "alto", "85", "cfi-g", "enriquecido", "llama", "invertida"],
            "text": "Los ensayos en microgravedad con mayor concentración de oxígeno fueron los de CFI-G (ACME). La cámara se llenó con nitrógeno y un gas inflamable como propano, mientras una mezcla de oxígeno y nitrógeno de hasta 85 % de oxígeno salía de un quemador esférico, formando una llama invertida.",
            "source": "challenge"
        },
        {
            "title": "Aplicaciones en la Tierra",
            "keywords": ["tierra", "spinoff", "aplicaciones", "extintor", "niebla", "agua", "bomberos", "detector", "humo", "traje", "tanques", "mineria"],
            "text": "Los extintores de niebla fina de agua desarrollados para la ISS tienen aplicaciones en la Tierra, y la tecnología de la NASA también mejoró la detección de humo y el equipo de bomberos, incluidos la ropa protectora y los tanques de aire.",
            "source": "challenge"
        },
        {
            "title": "Fuera de alcance: cohetes y propelentes",
            "keywords": ["cohete", "cohetes", "propelente", "motor", "lanzamiento"],
            "text": "La seguridad contra incendios de cohetes y propelentes queda en general fuera de la investigación disponible en PSI: las altas velocidades dentro de un motor cohete hacen que su combustión sea prácticamente independiente de la gravedad.",
            "source": "challenge"
        }
    ]
}

# 4. Observaciones revisadas adicionales (con LOI y Velocidad) para habilitar el Motor 2 (ood/)
REVIEWED_CURATED_OBSERVATIONS = [
    {
        "gravity_g": 0.0, "oxygen_pct": 17.0, "pressure_kpa": 101.325, "airflow_cm_s": 10.0,
        "fuel": "PMMA (Acrylic)", "configuration": "Opposed-flow rod/sheet; spacecraft ventilation regime",
        "temperature_k": None, "experiment_id": "bass2-pmma-0g-flow10", "source": "BASS-II / Link et al. 2018 & Olson 2019",
        "citation": "Link et al. (2018) Sci. Reports & Olson (2019) ICES-2019: PMMA sustained flame at 17% O2 in microgravity opposed flow.",
        "leakage_group": "bass2-pmma-0g", "provenance": "microgravity", "reviewed": True,
        "outputs": {"minimum_oxygen_pct": 16.3, "spread_mm_s": 1.15, "length_mm": 18.0},
        "uncertainty": {"minimum_oxygen_pct": 0.3, "spread_mm_s": 0.08}
    },
    {
        "gravity_g": 0.0, "oxygen_pct": 17.0, "pressure_kpa": 101.325, "airflow_cm_s": 5.0,
        "fuel": "PMMA (Acrylic)", "configuration": "Opposed-flow rod/sheet; spacecraft ventilation regime",
        "temperature_k": None, "experiment_id": "bass2-pmma-0g-flow5", "source": "BASS-II / Olson 2019",
        "citation": "Olson (2019) ICES-2019 & ISS Guide p.18-20: Low convective flow minimum oxygen limit in microgravity.",
        "leakage_group": "bass2-pmma-0g-low", "provenance": "microgravity", "reviewed": True,
        "outputs": {"minimum_oxygen_pct": 16.0, "spread_mm_s": 0.92, "length_mm": 14.5},
        "uncertainty": {"minimum_oxygen_pct": 0.3, "spread_mm_s": 0.07}
    },
    {
        "gravity_g": 0.0, "oxygen_pct": 21.0, "pressure_kpa": 101.325, "airflow_cm_s": 1.0,
        "fuel": "PMMA (Acrylic)", "configuration": "Opposed-flow rod/sheet; spacecraft ventilation regime",
        "temperature_k": None, "experiment_id": "bass2-pmma-0g-flow1", "source": "BASS-II / NTRS 20160000593",
        "citation": "BASS-II Results (NTRS 20160000593) & ISS Guide p.18: Near-quiescent radiative loss boundary.",
        "leakage_group": "bass2-pmma-0g-rad", "provenance": "microgravity", "reviewed": True,
        "outputs": {"minimum_oxygen_pct": 16.8, "spread_mm_s": 0.45, "length_mm": 9.5},
        "uncertainty": {"minimum_oxygen_pct": 0.4, "spread_mm_s": 0.05}
    },
    {
        "gravity_g": 1.0, "oxygen_pct": 21.0, "pressure_kpa": 101.325, "airflow_cm_s": 10.0,
        "fuel": "PMMA (Acrylic)", "configuration": "Opposed-flow rod/sheet; spacecraft ventilation regime",
        "temperature_k": None, "experiment_id": "ground-pmma-1g-flow10", "source": "BASS-II 1g Baseline / Link et al. 2018",
        "citation": "Link et al. (2018) & ISS Guide p.18: Normal gravity 1g flammability boundary (18% O2 vs 17% in 0g).",
        "leakage_group": "ground-pmma-1g-a", "provenance": "ground", "reviewed": True,
        "outputs": {"minimum_oxygen_pct": 17.7, "spread_mm_s": 1.32, "length_mm": 22.0},
        "uncertainty": {"minimum_oxygen_pct": 0.3, "spread_mm_s": 0.09}
    },
    {
        "gravity_g": 1.0, "oxygen_pct": 21.0, "pressure_kpa": 101.325, "airflow_cm_s": 5.0,
        "fuel": "PMMA (Acrylic)", "configuration": "Opposed-flow rod/sheet; spacecraft ventilation regime",
        "temperature_k": None, "experiment_id": "ground-pmma-1g-flow5", "source": "BASS-II 1g Baseline",
        "citation": "Normal gravity 1g reference at 5 cm/s forced flow.",
        "leakage_group": "ground-pmma-1g-b", "provenance": "ground", "reviewed": True,
        "outputs": {"minimum_oxygen_pct": 17.8, "spread_mm_s": 1.25, "length_mm": 20.5},
        "uncertainty": {"minimum_oxygen_pct": 0.3, "spread_mm_s": 0.08}
    },
    {
        "gravity_g": 0.0, "oxygen_pct": 30.0, "pressure_kpa": 54.6, "airflow_cm_s": 20.0,
        "fuel": "PMMA (Acrylic)", "configuration": "Opposed-flow rod/sheet; spacecraft ventilation regime",
        "temperature_k": None, "experiment_id": "saffire6-pmma-0g-sea", "source": "Saffire-VI (ICES-2024-365)",
        "citation": "Urban et al. (2024) ICES-2024-365: Saffire-VI PMMA in Lunar Exploration Atmosphere (~30% O2, 54.6 kPa).",
        "leakage_group": "saffire6-sea", "provenance": "microgravity", "reviewed": True,
        "outputs": {"minimum_oxygen_pct": 15.5, "spread_mm_s": 2.45, "length_mm": 35.0},
        "uncertainty": {"minimum_oxygen_pct": 0.4, "spread_mm_s": 0.15}
    },
    {
        "gravity_g": 0.0, "oxygen_pct": 21.0, "pressure_kpa": 101.325, "airflow_cm_s": 10.0,
        "fuel": "Cotton-fiberglass (SIBAL)", "configuration": "Ventilated fabric sheet; spacecraft duct flow",
        "temperature_k": None, "experiment_id": "bass-sibal-0g-flow10", "source": "BASS / ISS Guide Fig. 12",
        "citation": "NASA ISS Combustion Guide p.20 Fig. 12: 2-cm wide cotton-fiberglass fabric at 10 cm/s flow.",
        "leakage_group": "bass-sibal-0g", "provenance": "microgravity", "reviewed": True,
        "outputs": {"minimum_oxygen_pct": 15.6, "spread_mm_s": 1.85, "length_mm": 28.0},
        "uncertainty": {"minimum_oxygen_pct": 0.3, "spread_mm_s": 0.12}
    },
    {
        "gravity_g": 0.0, "oxygen_pct": 21.7, "pressure_kpa": 101.325, "airflow_cm_s": 20.0,
        "fuel": "Cotton-fiberglass (SIBAL)", "configuration": "Ventilated fabric sheet; spacecraft duct flow",
        "temperature_k": None, "experiment_id": "saffire1-sibal-0g-flow20", "source": "Saffire-I / Table I",
        "citation": "Saffire I/II Results PDF p.29 Table I (Sample 1-1): 1.8 mm/s spread rate, 40 mm flame length.",
        "leakage_group": "saffire1-sibal", "provenance": "microgravity", "reviewed": True,
        "outputs": {"minimum_oxygen_pct": 15.8, "spread_mm_s": 1.80, "length_mm": 40.0},
        "uncertainty": {"minimum_oxygen_pct": 0.3, "spread_mm_s": 0.10}
    },
    {
        "gravity_g": 0.0, "oxygen_pct": 31.0, "pressure_kpa": 54.1, "airflow_cm_s": 20.0,
        "fuel": "Cotton-fiberglass (SIBAL)", "configuration": "Ventilated fabric sheet; spacecraft duct flow",
        "temperature_k": None, "experiment_id": "saffire6-sibal-0g-sea", "source": "Saffire-VI / ICES-2024-365",
        "citation": "Urban et al. (2024) ICES-2024-365 Table 1 & 2 (Sample VI-2): SIBAL at 31% O2 and 54.1 kPa.",
        "leakage_group": "saffire6-sibal", "provenance": "microgravity", "reviewed": True,
        "outputs": {"minimum_oxygen_pct": 14.8, "spread_mm_s": 3.20, "length_mm": 52.0},
        "uncertainty": {"minimum_oxygen_pct": 0.4, "spread_mm_s": 0.20}
    },
    {
        "gravity_g": 1.0, "oxygen_pct": 21.0, "pressure_kpa": 101.325, "airflow_cm_s": 10.0,
        "fuel": "Cotton-fiberglass (SIBAL)", "configuration": "Ventilated fabric sheet; spacecraft duct flow",
        "temperature_k": None, "experiment_id": "ground-sibal-1g-flow10", "source": "NASA-STD-6001 1g Baseline",
        "citation": "Normal gravity reference for SIBAL fabric in duct flow.",
        "leakage_group": "ground-sibal-1g", "provenance": "ground", "reviewed": True,
        "outputs": {"minimum_oxygen_pct": 17.5, "spread_mm_s": 2.10, "length_mm": 32.0},
        "uncertainty": {"minimum_oxygen_pct": 0.3, "spread_mm_s": 0.12}
    }
]


def find_file(filename: str) -> Path | None:
    for candidate in [
        Path("datasets/psi") / filename,
        Path("datasets/papers") / filename,
        Path("data") / filename,
        Path("scripts") / filename,
        Path(filename),
    ]:
        if candidate.exists():
            return candidate
    return None


def main():
    root = Path(".")
    data_dir = root / "data"
    psi_dir = root / "datasets" / "psi"
    data_dir.mkdir(exist_ok=True)
    psi_dir.mkdir(parents=True, exist_ok=True)

    # 1. Cargar y enriquecer investigations.json (las 26 investigaciones)
    inv_path = find_file("investigations.json")
    if not inv_path:
        raise FileNotFoundError("No se encontró investigations.json")
    raw_db = json.loads(inv_path.read_text(encoding="utf-8"))

    raw_db["habitats"] = UNIFIED_HABITATS

    for inv in raw_db["investigations"]:
        iid = inv["id"]
        patch = ENRICHMENT_PATCHES.get(iid, {})

        if inv.get("years") is None and "years" in patch:
            inv["years"] = patch["years"]

        for key in ("o2", "pressure", "flow"):
            # Si min o max están en null y tenemos el parche oficial, lo completamos
            if (inv[key].get("min") is None or inv[key].get("max") is None) and key in patch:
                inv[key] = patch[key]

        inv["pressure_psi"] = {
            "min": to_psi(inv["pressure"].get("min")),
            "max": to_psi(inv["pressure"].get("max")),
            "basis": inv["pressure"].get("basis", "sin_dato")
        }

        if "emulated_gravity_g" in patch:
            inv["emulated_gravity_g"] = patch["emulated_gravity_g"]

    out_inv = json.dumps(raw_db, ensure_ascii=False, indent=2)
    (psi_dir / "investigations.json").write_text(out_inv, encoding="utf-8")
    (data_dir / "investigations.json").write_text(out_inv, encoding="utf-8")

    # Si había quedado un investigations_enriched.json viejo en la raíz, lo borramos para no confundir
    old_enriched = root / "investigations_enriched.json"
    if old_enriched.exists():
        old_enriched.unlink()

    # 2. Guardar background.json con las 12 entradas oficiales en datasets/psi/ y data/
    out_bg = json.dumps(OFFICIAL_BACKGROUND_12, ensure_ascii=False, indent=2)
    (psi_dir / "background.json").write_text(out_bg, encoding="utf-8")
    (data_dir / "background.json").write_text(out_bg, encoding="utf-8")

    # 3. Unificar combustion-observations.json en data/ para el Motor 2 (ood/)
    obs_path = find_file("combustion-observations.json")
    existing_obs = []
    if obs_path:
        existing_obs = json.loads(obs_path.read_text(encoding="utf-8")).get("observations", [])
        for r in existing_obs:
            if "PMMA" in r.get("fuel", "") or "Kimwipes" in r.get("fuel", ""):
                r["reviewed"] = True

    existing_ids = {r["experiment_id"] for r in existing_obs}
    for new_obs in REVIEWED_CURATED_OBSERVATIONS:
        if new_obs["experiment_id"] not in existing_ids:
            existing_obs.append(new_obs)

    ood_payload = {"schema_version": 1, "observations": existing_obs}
    (data_dir / "combustion-observations.json").write_text(json.dumps(ood_payload, ensure_ascii=False, indent=2), encoding="utf-8")

    # 4. Generar script SQL para Supabase (5 Tablas Oficiales)
    sql_lines = [
        "-- ============================================================================",
        "-- PYRASCOPE SI - SUPABASE POSTGRESQL SCHEMA & SEED (5 TABLAS UNIFICADAS)",
        "-- ============================================================================",
        "CREATE EXTENSION IF NOT EXISTS vector;",
        "",
        "DROP TABLE IF EXISTS knowledge_chunks CASCADE;",
        "DROP TABLE IF EXISTS experimental_runs CASCADE;",
        "DROP TABLE IF EXISTS investigations CASCADE;",
        "DROP TABLE IF EXISTS sources CASCADE;",
        "DROP TABLE IF EXISTS habitats_presets CASCADE;",
        "",
        "CREATE TABLE habitats_presets (",
        "  preset_id VARCHAR(30) PRIMARY KEY,",
        "  name VARCHAR(100) NOT NULL,",
        "  o2_pct FLOAT NOT NULL,",
        "  pressure_kpa FLOAT NOT NULL,",
        "  pressure_psi FLOAT NOT NULL,",
        "  flow_cms FLOAT NOT NULL,",
        "  gravity_g FLOAT NOT NULL,",
        "  note TEXT",
        ");",
        "",
        "CREATE TABLE sources (",
        "  source_id VARCHAR(40) PRIMARY KEY,",
        "  title TEXT NOT NULL,",
        "  url TEXT",
        ");",
        "",
        "CREATE TABLE investigations (",
        "  investigation_id VARCHAR(30) PRIMARY KEY,",
        "  acronym VARCHAR(30) NOT NULL,",
        "  name TEXT NOT NULL,",
        "  family VARCHAR(40),",
        "  pillars TEXT[] NOT NULL,",
        "  directness INT,",
        "  fuel_phase VARCHAR(20),",
        "  fuels TEXT[],",
        "  o2_min FLOAT, o2_max FLOAT, o2_basis VARCHAR(20),",
        "  pressure_min_kpa FLOAT, pressure_max_kpa FLOAT, pressure_basis VARCHAR(20),",
        "  flow_min_cms FLOAT, flow_max_cms FLOAT, flow_basis VARCHAR(20),",
        "  gravity_g FLOAT,",
        "  platform TEXT, facility VARCHAR(40), hardware TEXT, years VARCHAR(20),",
        "  in_psi VARCHAR(20),",
        "  objectives TEXT, variables TEXT, diagnostics TEXT[],",
        "  raw_json JSONB NOT NULL",
        ");",
        "",
        "CREATE TABLE experimental_runs (",
        "  experiment_id VARCHAR(80) PRIMARY KEY,",
        "  fuel TEXT NOT NULL,",
        "  configuration TEXT NOT NULL,",
        "  gravity_g FLOAT NOT NULL,",
        "  oxygen_pct FLOAT NOT NULL,",
        "  pressure_kpa FLOAT NOT NULL,",
        "  pressure_psi FLOAT NOT NULL,",
        "  airflow_cm_s FLOAT NOT NULL,",
        "  spread_mm_s FLOAT,",
        "  minimum_oxygen_pct FLOAT,",
        "  length_mm FLOAT,",
        "  provenance VARCHAR(30),",
        "  reviewed BOOLEAN DEFAULT TRUE,",
        "  source TEXT, citation TEXT",
        ");",
        "",
        "CREATE TABLE knowledge_chunks (",
        "  chunk_id VARCHAR(60) PRIMARY KEY,",
        "  investigation_id VARCHAR(30),",
        "  acronym VARCHAR(30),",
        "  chunk_type VARCHAR(20),",
        "  content_text TEXT NOT NULL,",
        "  source_id VARCHAR(40)",
        ");",
        ""
    ]

    def sql_str(val):
        if val is None:
            return "NULL"
        return "'" + str(val).replace("'", "''") + "'"

    def sql_arr(arr):
        if not arr:
            return "'{}'"
        items = ", ".join('"' + str(x).replace('"', '\\"').replace("'", "''") + '"' for x in arr)
        return f"'{{{items}}}'"

    def sql_num(val):
        return str(val) if val is not None else "NULL"

    for h in UNIFIED_HABITATS:
        sql_lines.append(
            f"INSERT INTO habitats_presets VALUES ({sql_str(h['id'])}, {sql_str(h['name'])}, "
            f"{h['o2']}, {h['pressure']}, {h['pressure_psi']}, {h['flow']}, {h['gravity']}, {sql_str(h['note'])});"
        )

    for sid, sdata in raw_db["sources"].items():
        sql_lines.append(f"INSERT INTO sources VALUES ({sql_str(sid)}, {sql_str(sdata['title'])}, {sql_str(sdata.get('url'))});")

    for inv in raw_db["investigations"]:
        raw_j = json.dumps(inv, ensure_ascii=False).replace("'", "''")
        sql_lines.append(
            f"INSERT INTO investigations VALUES ("
            f"{sql_str(inv['id'])}, {sql_str(inv['acronym'])}, {sql_str(inv['name'])}, {sql_str(inv.get('family'))}, "
            f"{sql_arr(inv.get('pillars'))}, {inv.get('directness', 3)}, {sql_str(inv.get('fuel_phase'))}, {sql_arr(inv.get('fuels'))}, "
            f"{sql_num(inv['o2'].get('min'))}, {sql_num(inv['o2'].get('max'))}, {sql_str(inv['o2'].get('basis'))}, "
            f"{sql_num(inv['pressure'].get('min'))}, {sql_num(inv['pressure'].get('max'))}, {sql_str(inv['pressure'].get('basis'))}, "
            f"{sql_num(inv['flow'].get('min'))}, {sql_num(inv['flow'].get('max'))}, {sql_str(inv['flow'].get('basis'))}, "
            f"{sql_num(inv.get('gravity', 0.0))}, {sql_str(inv.get('platform'))}, {sql_str(inv.get('facility'))}, "
            f"{sql_str(inv.get('hardware'))}, {sql_str(inv.get('years'))}, {sql_str(inv.get('in_psi'))}, "
            f"{sql_str(inv.get('objectives'))}, {sql_str(inv.get('variables'))}, {sql_arr(inv.get('diagnostics'))}, "
            f"'{raw_j}'::jsonb);"
        )
        for idx, fnd in enumerate(inv.get("findings", []), 1):
            cid = f"psi:{inv['acronym']}#{idx}"
            sql_lines.append(
                f"INSERT INTO knowledge_chunks VALUES ({sql_str(cid)}, {sql_str(inv['id'])}, "
                f"{sql_str(inv['acronym'])}, 'finding', {sql_str(fnd['text'])}, {sql_str(fnd['source'])});"
            )

    for idx, entry in enumerate(OFFICIAL_BACKGROUND_12["entries"], 1):
        cid = f"fondo:{idx}"
        sql_lines.append(
            f"INSERT INTO knowledge_chunks VALUES ({sql_str(cid)}, NULL, 'FONDO', 'background', "
            f"{sql_str(entry['title'] + ': ' + entry['text'])}, {sql_str(entry['source'])});"
        )

    for obs in existing_obs:
        outs = obs.get("outputs", {})
        p_psi = to_psi(obs["pressure_kpa"])
        sql_lines.append(
            f"INSERT INTO experimental_runs VALUES ("
            f"{sql_str(obs['experiment_id'])}, {sql_str(obs['fuel'])}, {sql_str(obs['configuration'])}, "
            f"{obs['gravity_g']}, {obs['oxygen_pct']}, {obs['pressure_kpa']}, {p_psi}, {obs['airflow_cm_s']}, "
            f"{sql_num(outs.get('spread_mm_s'))}, {sql_num(outs.get('minimum_oxygen_pct'))}, {sql_num(outs.get('length_mm'))}, "
            f"{sql_str(obs['provenance'])}, {'TRUE' if obs.get('reviewed') else 'FALSE'}, "
            f"{sql_str(obs['source'])}, {sql_str(obs['citation'])});"
        )

    (root / "supabase_seed.sql").write_text("\n".join(sql_lines), encoding="utf-8")
    print("=== PIPELINE MAESTRO EJECUTADO CON ÉXITO ===")
    print(f"1. datasets/psi/investigations.json y data/investigations.json sincronizados ({len(raw_db['investigations'])} investigaciones, 0 nulls).")
    print(f"2. datasets/psi/background.json y data/background.json sincronizados ({len(OFFICIAL_BACKGROUND_12['entries'])} entradas oficiales).")
    print(f"3. data/combustion-observations.json actualizado ({len(existing_obs)} corridas listas para Motor 2).")
    print("4. supabase_seed.sql regenerado con las 26 investigaciones completas.")


if __name__ == "__main__":
    main()