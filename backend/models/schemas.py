from pydantic import BaseModel
from typing import List, Optional, Dict, Any


class CellEmission(BaseModel):
    cell_index: int
    cell_label: str
    cell_type: str          # "training", "testing", "preprocessing", "inference", "other"
    source_preview: str
    duration_seconds: float
    energy_kwh: float
    co2_grams: float
    measurement_type: str   # "live" | "static" | "combined"
    execution_error: Optional[str] = None  # non-null if the cell raised an exception

    # Component breakdown (mirrors CodeCarbon's per-component reporting)
    cpu_energy_kwh: Optional[float] = None   # CPU process-time × TDP model
    ram_energy_kwh: Optional[float] = None   # process RSS × DRAM power model
    gpu_energy_kwh: Optional[float] = None   # nvidia-smi power draw × duration
    cpu_power_w:    Optional[float] = None   # effective CPU power during cell
    ram_power_w:    Optional[float] = None   # effective RAM power during cell
    gpu_power_w:    Optional[float] = None   # average GPU draw during cell


class StaticAnalysis(BaseModel):
    framework: str
    model_type: str
    has_training: bool
    has_testing: bool
    training_cell_indices: List[int]
    testing_cell_indices: List[int]
    preprocessing_cell_indices: List[int]
    estimated_flops: Optional[float]
    detected_patterns: List[str]
    complexity_tier: str    # "light", "medium", "heavy", "very_heavy"


class HardwareInfo(BaseModel):
    cpu_model: str
    cpu_count: int
    ram_gb: float
    gpu_available: bool
    gpu_model: Optional[str]
    platform: str
    os: str


class EmissionSummary(BaseModel):
    total_energy_kwh: float
    total_co2_grams: float
    total_duration_seconds: float
    equivalent_km_driven: float
    equivalent_hours_laptop: float
    equivalent_smartphone_charges: float
    region: Optional[str]
    grid_intensity_g_per_kwh: float
    training_co2_grams: float
    testing_co2_grams: float
    other_co2_grams: float


class AnalysisResult(BaseModel):
    job_id: str
    notebook_name: str
    dataset_name: str
    timestamp: str
    summary: EmissionSummary
    cell_breakdown: List[CellEmission]
    static_analysis: StaticAnalysis
    hardware_info: HardwareInfo
    cells_with_errors: int = 0          # count of cells that raised an exception during execution
    execution_note: Optional[str] = None  # human-readable warning shown in the UI


class Suggestion(BaseModel):
    title: str
    description: str
    impact: str        # "high" | "medium" | "low"
    category: str      # "model_architecture" | "training_strategy" | "hardware" | "data_pipeline" | "quantization"
    estimated_savings: Optional[str]
    source_reference: str


class SuggestionsResult(BaseModel):
    job_id: str
    suggestions: List[Suggestion]
    summary_insight: str
    interpretation: Optional[str] = None   # layman explanation of results


class AnalysisResponse(BaseModel):
    job_id: str
    analysis: AnalysisResult
    suggestions: SuggestionsResult
