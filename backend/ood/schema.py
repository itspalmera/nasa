"""Version 1 observation contract. Gravity is a ratio to standard gravity."""
from typing import Literal
from pydantic import BaseModel, ConfigDict, Field, model_validator

OUTPUTS = {'minimum_oxygen_pct': '%', 'spread_mm_s': 'mm/s', 'length_mm': 'mm', 'temperature_k': 'K'}
OutputName = Literal['minimum_oxygen_pct', 'spread_mm_s', 'length_mm', 'temperature_k']
FEATURES = ['gravity_g', 'oxygen_pct', 'pressure_kpa', 'airflow_cm_s']

class Conditions(BaseModel):
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    gravity_g: float = Field(ge=0)
    oxygen_pct: float = Field(ge=0, le=100)
    pressure_kpa: float = Field(gt=0)
    airflow_cm_s: float = Field(ge=0)
    fuel: str = Field(min_length=1)
    configuration: str = Field(min_length=1)
    temperature_k: float | None = Field(default=None, gt=0)

class Observation(Conditions):
    experiment_id: str = Field(min_length=1)
    source: str = Field(min_length=1)
    citation: str = Field(min_length=1)
    leakage_group: str = Field(min_length=1, description='Shared campaign/run/source dependency group')
    provenance: Literal['ground', 'partial_gravity', 'microgravity', 'efield_analog', 'simulation', 'model_prediction']
    reviewed: bool = False
    outputs: dict[OutputName, float | None]
    uncertainty: dict[OutputName, float] = Field(default_factory=dict, description='One standard deviation in output units')

    @model_validator(mode='after')
    def valid_outputs(self):
        import math
        for key, value in self.outputs.items():
            if key not in OUTPUTS:
                raise ValueError(f'Unsupported output: {key}')
            if value is not None and (not math.isfinite(value) or value < 0 or (key == 'minimum_oxygen_pct' and value > 100)):
                raise ValueError(f'Invalid output: {key}')
        for key, value in self.uncertainty.items():
            if key not in self.outputs or self.outputs[key] is None or not math.isfinite(value) or value < 0:
                raise ValueError('Uncertainty requires an observed output and nonnegative finite standard deviation')
        return self

class Query(Conditions):
    data_mode: Literal['reviewed', 'exploratory'] = Field(default='reviewed', description='Explicit opt-in to exploratory fits on unreviewed direct observations; never enables scientific validation')
    model: Literal['gpr', 'boosting', 'physics_gpr'] = 'gpr'
    holdout_g: float | None = Field(default=None, ge=0)


class Dataset(BaseModel):
    """Strict envelope shared by the loader and downloadable JSON Schema."""
    model_config = ConfigDict(extra='forbid')
    schema_version: Literal[1]
    observations: list[Observation]


class EvidenceQuery(BaseModel):
    """Inspection is cohort-based; it does not impute a prediction query."""
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    fuel: str = Field(min_length=1)
    configuration: str = Field(min_length=1)
    temperature_available: bool = False
    data_mode: Literal['reviewed', 'exploratory'] = 'reviewed'
    gravity_g: float | None = Field(default=None, ge=0)


class GravitySweepQuery(BaseModel):
    """Hold recorded environmental inputs fixed while varying gravity on a grid."""
    model_config = ConfigDict(extra='forbid', allow_inf_nan=False)
    oxygen_pct: float = Field(ge=0, le=100)
    pressure_kpa: float = Field(gt=0)
    airflow_cm_s: float = Field(ge=0)
    fuel: str = Field(min_length=1)
    configuration: str = Field(min_length=1)
    temperature_k: float | None = Field(default=None, gt=0)
    data_mode: Literal['reviewed', 'exploratory'] = 'reviewed'
    model: Literal['gpr', 'boosting', 'physics_gpr'] = 'gpr'
    property_name: OutputName = 'spread_mm_s'
