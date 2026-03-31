"""
Calls the Groq API (Llama 3.3 70B) with retrieved document context
to generate specific, actionable carbon reduction suggestions.
"""

import os
import json
import re
from typing import List, Dict
from groq import Groq
from models.schemas import Suggestion, SuggestionsResult

GROQ_MODEL = "llama-3.3-70b-versatile"


def _build_system_prompt() -> str:
    return """You are GreenTrace, an expert AI assistant specializing in reducing the carbon footprint of machine learning and deep learning workloads.

Your role is to analyze a user's ML notebook and generate specific, actionable suggestions to reduce its carbon emissions. 

You will receive:
1. A summary of the notebook's carbon emissions and runtime profile.
2. Static analysis of the notebook (framework, model type, detected patterns).

You must respond ONLY with a valid JSON object in the following exact format — no markdown, no explanation, no preamble:
{
  "summary_insight": "A 2-3 sentence overall insight about this notebook's carbon profile and the biggest opportunity for reduction.",
  "suggestions": [
    {
      "title": "Short, actionable title",
      "description": "Clear, specific description of what to do and why it reduces carbon. Reference the notebook's specific context (framework, model type, detected patterns) where relevant.",
      "impact": "high|medium|low",
      "category": "model_architecture|training_strategy|hardware|data_pipeline|quantization",
      "estimated_savings": "Optional: e.g. '30-50% reduction in training energy'",
      "source_reference": "Name of the reference document or technique source"
    }
  ]
}

Rules:
- Generate 4-6 suggestions, ordered from highest to lowest impact.
- Be SPECIFIC to the notebook's detected framework, model type, and patterns.
- If a pattern is already detected (e.g. mixed_precision is present), do NOT suggest it again.
- Each description should explain HOW to implement the change, not just what it is.
- Keep descriptions concise but actionable (2-4 sentences).
"""


def _build_user_prompt(
    static_analysis,
    summary,
    hardware_info,
) -> str:

    detected = static_analysis.detected_patterns or []
    training_cells = len(static_analysis.training_cell_indices)
    testing_cells  = len(static_analysis.testing_cell_indices)

    return f"""## Notebook Analysis

**Framework:** {static_analysis.framework}
**Model type:** {static_analysis.model_type}
**Complexity tier:** {static_analysis.complexity_tier}
**Detected patterns:** {', '.join(detected) if detected else 'none'}
**Training cells:** {training_cells}
**Testing cells:** {testing_cells}

## Emission Summary

**Total CO₂:** {summary.total_co2_grams:.4f} grams
**Total energy:** {summary.total_energy_kwh:.8f} kWh
**Training CO₂:** {summary.training_co2_grams:.4f} g ({(summary.training_co2_grams / max(summary.total_co2_grams, 0.0001) * 100):.1f}% of total)
**Testing CO₂:** {summary.testing_co2_grams:.4f} g
**Grid intensity:** {summary.grid_intensity_g_per_kwh} gCO₂/kWh
**Region:** {summary.region or 'global average'}

## Hardware

**CPU:** {hardware_info.cpu_model}
**GPU:** {hardware_info.gpu_model or 'not detected'}
**RAM:** {hardware_info.ram_gb} GB

---

Based on the above, generate specific carbon reduction suggestions for this notebook as a JSON object.
"""


def generate_suggestions(
    static_analysis,
    summary,
    hardware_info,
) -> SuggestionsResult:
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        raise ValueError(
            "GROQ_API_KEY environment variable is not set. "
            "Please add your Groq API key to the .env file."
        )

    client = Groq(api_key=api_key)

    response = client.chat.completions.create(
        model=GROQ_MODEL,
        messages=[
            {"role": "system", "content": _build_system_prompt()},
            {"role": "user",   "content": _build_user_prompt(
                static_analysis, summary, hardware_info
            )},
        ],
        temperature=0.4,
        max_tokens=2048,
        response_format={"type": "json_object"},
    )

    raw = response.choices[0].message.content

    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        # Strip any accidental markdown fences
        clean = re.sub(r"```json|```", "", raw).strip()
        data = json.loads(clean)

    suggestions = [
        Suggestion(
            title=s.get("title", "Optimization"),
            description=s.get("description", ""),
            impact=s.get("impact", "medium"),
            category=s.get("category", "training_strategy"),
            estimated_savings=s.get("estimated_savings"),
            source_reference=s.get("source_reference", "Green-AI research"),
        )
        for s in data.get("suggestions", [])
    ]

    return SuggestionsResult(
        job_id="",  # filled in by caller
        suggestions=suggestions,
        summary_insight=data.get("summary_insight", ""),
    )


# ──────────────────────────────────────────────────────────────────────────────
# Layman interpretation generator
# ──────────────────────────────────────────────────────────────────────────────

def generate_interpretation(
    static_analysis,
    summary,
    hardware_info,
    cell_emissions: list,
) -> str:
    """
    Generate a plain-English, layman-friendly explanation of the carbon results.
    Returns a single multi-paragraph markdown string.
    """
    api_key = os.getenv("GROQ_API_KEY")
    if not api_key:
        return ""

    # Build a focused summary of the heaviest cells
    sorted_cells = sorted(cell_emissions, key=lambda c: c.co2_grams, reverse=True)
    top_cells = sorted_cells[:5]
    top_cells_text = "\n".join(
        f"  - {c.cell_label} ({c.cell_type}): {c.co2_grams:.6f} g CO₂ | {c.duration_seconds:.3f}s | preview: {c.source_preview[:60]!r}"
        for c in top_cells
    )

    training_pct = (
        summary.training_co2_grams / max(summary.total_co2_grams, 1e-9) * 100
    )

    intensity_label = (
        "very low" if summary.total_co2_grams < 0.01 else
        "low"      if summary.total_co2_grams < 0.5  else
        "moderate" if summary.total_co2_grams < 5.0  else
        "high"     if summary.total_co2_grams < 50   else
        "very high"
    )

    system_prompt = """You are GreenTrace, an expert at explaining technical carbon footprint data to everyday users who are NOT data scientists or engineers.

Your job is to write a clear, friendly, human explanation of what the notebook's carbon emissions mean — in plain English that anyone can understand.

Rules:
- Do NOT use jargon or technical terms without explaining them.
- Use relatable real-world comparisons (phone charging, car trips, light bulb hours).
- Explain WHY some cells emit more than others in simple terms.
- Mention the measurement uncertainty honestly but reassuringly.
- Write in a warm, helpful tone — like a knowledgeable friend explaining this over coffee.
- Structure your response as exactly 4 paragraphs separated by blank lines:
  Paragraph 1: What the overall result means in plain English (the big picture).
  Paragraph 2: Which parts of the notebook used the most energy and why (in simple terms).
  Paragraph 3: How this compares to everyday activities (real-world context).
  Paragraph 4: Why the measurement might vary slightly between runs and what that means.
- Keep each paragraph to 3-4 sentences. Do NOT use bullet points or markdown headers.
- Do NOT start with "Sure," or "Certainly," — just dive in.
"""

    user_prompt = f"""Here are the results from running a machine learning notebook:

Notebook: "{static_analysis.framework}" framework, "{static_analysis.model_type}" model type
Complexity: {static_analysis.complexity_tier}
Region: {summary.region or "global average"} (grid carbon intensity: {summary.grid_intensity_g_per_kwh} gCO₂/kWh)

Total CO₂ emitted: {summary.total_co2_grams:.6f} grams
Total energy used: {summary.total_energy_kwh:.8f} kWh
Total runtime: {summary.total_duration_seconds:.1f} seconds
Intensity level: {intensity_label}

Training cells contributed: {training_pct:.1f}% of total emissions
Equivalent to driving: {summary.equivalent_km_driven} km in a petrol car
Equivalent to: {summary.equivalent_smartphone_charges} smartphone charges

Top 5 highest-emission cells:
{top_cells_text}

Hardware used: {hardware_info.cpu_model}, {hardware_info.ram_gb}GB RAM, GPU: {hardware_info.gpu_model or 'not detected'}

Write the 4-paragraph explanation now."""

    try:
        client = Groq(api_key=api_key)
        response = client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": system_prompt},
                {"role": "user",   "content": user_prompt},
            ],
            temperature=0.6,
            max_tokens=700,
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        return f"Interpretation could not be generated: {str(e)[:100]}"

