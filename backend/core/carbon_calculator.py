"""
Merges live execution and static analysis results into a final EmissionSummary.
Computes real-world equivalences with full precision preserved.
"""

from typing import List, Optional
from models.schemas import CellEmission, EmissionSummary, StaticAnalysis
from core.notebook_runner import get_grid_intensity


# ──────────────────────────────────────────────────────────────────────────────
# Equivalence constants  (sourced: EPA, Our World in Data, IEA)
# ──────────────────────────────────────────────────────────────────────────────

KM_PER_KG_CO2    = 6.4      # avg petrol car: ~156 gCO₂/km → 1 kg CO₂ ≈ 6.4 km
LAPTOP_WATTS     = 45.0     # average laptop TDP in use
SMARTPHONE_WH    = 12.68    # Wh per full smartphone charge (3220 mAh × 3.93 V)


def _sig(value: float, digits: int = 8) -> float:
    """Round to `digits` significant figures (not decimal places).
    Prevents both loss of precision for tiny values and excessive trailing zeros."""
    if value == 0:
        return 0.0
    from math import log10, floor
    magnitude = floor(log10(abs(value)))
    factor    = 10 ** (digits - 1 - magnitude)
    return round(value * factor) / factor


def build_summary(
    cell_emissions: List[CellEmission],
    region: Optional[str],
    static_analysis: StaticAnalysis,
) -> EmissionSummary:
    grid_intensity = get_grid_intensity(region)

    total_energy_kwh = sum(c.energy_kwh  for c in cell_emissions)
    total_co2_grams  = sum(c.co2_grams   for c in cell_emissions)
    total_duration_s = sum(c.duration_seconds for c in cell_emissions)

    training_co2 = sum(c.co2_grams for c in cell_emissions if c.cell_type == "training")
    testing_co2  = sum(c.co2_grams for c in cell_emissions if c.cell_type == "testing")
    other_co2    = total_co2_grams - training_co2 - testing_co2

    # ── Equivalences ──────────────────────────────────────────────────────────
    total_co2_kg  = total_co2_grams / 1000.0

    # Distance: grams CO₂ → kg → km driven by an avg petrol car
    km_driven     = total_co2_kg * KM_PER_KG_CO2

    # Laptop hours: kWh / (Watts/1000) = hours
    laptop_hours  = total_energy_kwh / (LAPTOP_WATTS / 1000.0)

    # Phone charges: kWh → Wh / Wh_per_charge
    phone_charges = (total_energy_kwh * 1000.0) / SMARTPHONE_WH

    return EmissionSummary(
        # Preserve full precision — frontend handles display formatting
        total_energy_kwh             = _sig(total_energy_kwh, 8),
        total_co2_grams              = _sig(total_co2_grams,  8),
        total_duration_seconds       = round(total_duration_s, 4),
        equivalent_km_driven         = _sig(km_driven,      6),
        equivalent_hours_laptop      = _sig(laptop_hours,   6),
        equivalent_smartphone_charges= _sig(phone_charges,  6),
        region                       = region,
        grid_intensity_g_per_kwh     = grid_intensity,
        training_co2_grams           = _sig(training_co2, 8),
        testing_co2_grams            = _sig(testing_co2,  8),
        other_co2_grams              = _sig(other_co2,    8),
    )
