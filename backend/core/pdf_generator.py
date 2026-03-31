"""
Generates a PDF report using ReportLab (pure Python, works on Windows).
Charts are generated with Matplotlib and embedded as images.
WeasyPrint / GTK is NOT required.
"""

import io
import os
from typing import List

import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches

from reportlab.lib.pagesizes import A4
from reportlab.lib.units import cm, mm
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_RIGHT
from reportlab.lib import colors
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, Image, KeepTogether,
)
from reportlab.platypus.flowables import BalancedColumns

from models.schemas import AnalysisResult, SuggestionsResult

# ── Brand colours ────────────────────────────────────────────────────────────
BG       = colors.HexColor("#030303")
SURFACE  = colors.HexColor("#0d0d0d")
BORDER   = colors.HexColor("#1f1f1f")
PURPLE   = colors.HexColor("#a855f7")
PURPLE_L = colors.HexColor("#c084fc")
PURPLE_D = colors.HexColor("#4c1d95")
WHITE    = colors.HexColor("#f1f5f9")
GRAY     = colors.HexColor("#94a3b8")
GRAY_D   = colors.HexColor("#475569")
RED      = colors.HexColor("#ef4444")
AMBER    = colors.HexColor("#f59e0b")
INDIGO   = colors.HexColor("#6366f1")
GREEN    = colors.HexColor("#10b981")

CELL_COLORS_MPL = {
    "training":      "#a855f7",
    "testing":       "#c084fc",
    "preprocessing": "#6366f1",
    "other":         "#4c1d95",
}


# ── Format helpers ────────────────────────────────────────────────────────────

def fmt_co2(grams: float) -> tuple[str, str]:
    if grams == 0: return ("0", "g CO₂")
    abs_g = abs(grams)
    if abs_g >= 1:    return (f"{grams:.4g}", "g CO₂")
    if abs_g >= 1e-3: return (f"{grams * 1e3:.4g}", "mg CO₂")
    if abs_g >= 1e-6: return (f"{grams * 1e6:.4g}", "µg CO₂")
    return                   (f"{grams * 1e9:.4g}", "ng CO₂")

def fmt_energy(kwh: float) -> tuple[str, str]:
    if kwh == 0: return ("0", "kWh")
    abs_e = abs(kwh)
    if abs_e >= 1:    return (f"{kwh:.4g}", "kWh")
    if abs_e >= 1e-3: return (f"{kwh * 1e3:.4g}", "Wh")
    if abs_e >= 1e-6: return (f"{kwh * 1e6:.4g}", "mWh")
    return                   (f"{kwh * 1e9:.4g}", "µWh")

def fmt_dur(s: float) -> tuple[str, str]:
    if s >= 1:    return (f"{s:.3f}", "s")
    if s >= 1e-3: return (f"{s * 1e3:.1f}", "ms")
    return               (f"{s * 1e6:.1f}", "µs")

def smart_num(n: float) -> str:
    if n == 0: return "0"
    if abs(n) >= 1e-3: return f"{n:.4g}"
    return f"{n:.3e}"


# ── Chart helpers ─────────────────────────────────────────────────────────────

def _fig_to_rl_image(fig, width_cm: float, height_cm: float) -> Image:
    buf = io.BytesIO()
    fig.savefig(buf, format="png", bbox_inches="tight", dpi=140,
                facecolor=fig.get_facecolor())
    plt.close(fig)
    buf.seek(0)
    img = Image(buf, width=width_cm * cm, height=height_cm * cm)
    return img


def _bar_chart(summary, cell_emissions) -> Image:
    labels = [c.cell_label for c in cell_emissions]
    
    # Auto-scale the chart unit based on total CO2
    _, global_unit = fmt_co2(summary.total_co2_grams)
    
    scale_factor = 1.0
    if global_unit == "mg CO₂": scale_factor = 1e3
    if global_unit == "µg CO₂": scale_factor = 1e6
    if global_unit == "ng CO₂": scale_factor = 1e9
    
    values = [c.co2_grams * scale_factor for c in cell_emissions]
    clrs   = [CELL_COLORS_MPL.get(c.cell_type, "#4c1d95") for c in cell_emissions]

    fig, ax = plt.subplots(figsize=(9, 3.2), facecolor="#0d0d0d")
    ax.set_facecolor("#141414")
    ax.bar(labels, values, color=clrs, width=0.65, edgecolor="none")
    ax.set_xlabel("Cell", color="#94a3b8", fontsize=8)
    
    y_label = global_unit.replace(" CO₂", "")
    ax.set_ylabel(f"CO₂ ({y_label})", color="#94a3b8", fontsize=8)
    
    ax.tick_params(colors="#94a3b8", labelsize=7)
    ax.spines[:].set_color("#2a2a2a")
    ax.set_xticks(range(len(labels)))
    ax.set_xticklabels(labels, rotation=40, ha="right", fontsize=7)

    legend = [mpatches.Patch(color=v, label=k.capitalize())
              for k, v in CELL_COLORS_MPL.items()]
    ax.legend(handles=legend, fontsize=7, framealpha=0.2,
              labelcolor="#cbd5e1", facecolor="#0d0d0d", edgecolor="#2a2a2a")
    fig.tight_layout()
    return _fig_to_rl_image(fig, 14, 5)


def _pie_chart(summary) -> Image:
    _, global_unit = fmt_co2(summary.total_co2_grams)
    scale_factor = 1.0
    if global_unit == "mg CO₂": scale_factor = 1e3
    if global_unit == "µg CO₂": scale_factor = 1e6
    if global_unit == "ng CO₂": scale_factor = 1e9

    data = {
        "Training": summary.training_co2_grams * scale_factor,
        "Testing":  summary.testing_co2_grams * scale_factor,
        "Other":    summary.other_co2_grams * scale_factor,
    }
    data = {k: v for k, v in data.items() if v > 0} or {"No data": 1}
    clrs = ["#a855f7", "#c084fc", "#4c1d95"]

    fig, ax = plt.subplots(figsize=(4, 4), facecolor="#0d0d0d")
    wedges, texts, autos = ax.pie(
        list(data.values()), labels=list(data.keys()),
        colors=clrs[:len(data)], autopct="%1.1f%%", startangle=140,
        wedgeprops={"edgecolor": "#0d0d0d", "linewidth": 2},
    )
    for t in texts:  t.set_color("#cbd5e1"); t.set_fontsize(8)
    for a in autos:  a.set_color("#fff");   a.set_fontsize(7)
    fig.tight_layout()
    return _fig_to_rl_image(fig, 6, 6)


# ── Style helpers ─────────────────────────────────────────────────────────────

def _para(text: str, style) -> Paragraph:
    return Paragraph(str(text), style)

def _hr():
    return HRFlowable(width="100%", thickness=0.5, color=BORDER, spaceAfter=8, spaceBefore=4)


def _section_title(text: str, styles) -> Paragraph:
    return Paragraph(text.upper(), styles["section_title"])


def _kpi_table(rows: list) -> Table:
    """rows = list of (label, value, unit) tuples, rendered as a dark KPI strip."""
    col_w = (A4[0] - 4 * cm) / len(rows)
    tbl_data = [
        [Paragraph(r[0], ParagraphStyle("kl", fontName="Helvetica",
                   fontSize=7, textColor=GRAY, leading=10)) for r in rows],
        [Paragraph(str(r[1]), ParagraphStyle("kv", fontName="Helvetica-Bold",
                   fontSize=18, textColor=WHITE, leading=22)) for r in rows],
        [Paragraph(r[2], ParagraphStyle("ku", fontName="Helvetica",
                   fontSize=7, textColor=GRAY_D, leading=10)) for r in rows],
    ]
    tbl = Table(tbl_data, colWidths=[col_w] * len(rows))
    tbl.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, -1), SURFACE),
        ("TOPPADDING",    (0, 0), (-1, -1), 12),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
        ("LEFTPADDING",   (0, 0), (-1, -1), 14),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 14),
        ("LINEAFTER",  (0, 0), (-2, -1), 0.5, BORDER),
        ("BOX", (0, 0), (-1, -1), 0.5, BORDER),
        ("ROUNDEDCORNERS", [6]),
    ]))
    return tbl


# ── Main entry point ──────────────────────────────────────────────────────────

def generate_pdf(
    analysis: AnalysisResult,
    suggestions: SuggestionsResult,
    output_path: str,
) -> str:
    doc = SimpleDocTemplate(
        output_path,
        pagesize=A4,
        leftMargin=2 * cm,
        rightMargin=2 * cm,
        topMargin=2 * cm,
        bottomMargin=2 * cm,
        title=f"GreenTrace Report — {analysis.notebook_name}",
        author="GreenTrace",
    )

    # ── Custom styles ─────────────────────────────────────────────────────────
    styles = {}

    styles["title"] = ParagraphStyle(
        "title", fontName="Helvetica-Bold", fontSize=28,
        textColor=WHITE, leading=34, spaceAfter=4,
    )
    styles["subtitle"] = ParagraphStyle(
        "subtitle", fontName="Helvetica", fontSize=12,
        textColor=GRAY, leading=16, spaceAfter=16,
    )
    styles["meta"] = ParagraphStyle(
        "meta", fontName="Helvetica", fontSize=8,
        textColor=GRAY_D, leading=12,
    )
    styles["section_title"] = ParagraphStyle(
        "section_title", fontName="Helvetica-Bold", fontSize=9,
        textColor=PURPLE, leading=14, spaceBefore=18, spaceAfter=10,
        letterSpacing=1.5,
    )
    styles["body"] = ParagraphStyle(
        "body", fontName="Helvetica", fontSize=9,
        textColor=GRAY, leading=14,
    )
    styles["mono"] = ParagraphStyle(
        "mono", fontName="Courier", fontSize=7.5,
        textColor=GRAY, leading=11,
    )
    styles["insight"] = ParagraphStyle(
        "insight", fontName="Helvetica", fontSize=9,
        textColor=PURPLE_L, leading=14, leftIndent=10,
        borderPad=10,
    )
    styles["sug_title"] = ParagraphStyle(
        "sug_title", fontName="Helvetica-Bold", fontSize=10,
        textColor=WHITE, leading=14,
    )

    summary   = analysis.summary
    static    = analysis.static_analysis
    hardware  = analysis.hardware_info

    story = []

    # ── Cover ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.8 * cm))
    story.append(_para("⬡  GreenTrace", ParagraphStyle(
        "logo", fontName="Helvetica-Bold", fontSize=10,
        textColor=PURPLE, letterSpacing=2, spaceAfter=20,
    )))
    story.append(_para("Carbon Footprint<br/>Analysis Report", styles["title"]))
    story.append(_para(analysis.notebook_name, styles["subtitle"]))
    story.append(_hr())
    meta_rows = [
        ["Dataset",       analysis.dataset_name],
        ["Region",        summary.region or "Global avg"],
        ["Grid intensity",f"{summary.grid_intensity_g_per_kwh} gCO₂/kWh"],
        ["Generated",     analysis.timestamp[:19].replace("T", " ")],
    ]
    for label, val in meta_rows:
        story.append(_para(
            f'<font color="#475569">{label}: </font>'
            f'<font color="#cbd5e1">{val}</font>',
            styles["meta"],
        ))
    story.append(Spacer(1, 0.6 * cm))

    # ── Summary KPIs ──────────────────────────────────────────────────────────
    story.append(_section_title("Emission Summary", styles))
    
    v_co2, u_co2 = fmt_co2(summary.total_co2_grams)
    v_e, u_e     = fmt_energy(summary.total_energy_kwh)
    v_d, u_d     = fmt_dur(summary.total_duration_seconds)
    
    km_raw = summary.equivalent_km_driven
    if km_raw < 0.001: km_disp = f"{km_raw * 1000:.3g} m"
    else:              km_disp = f"{smart_num(km_raw)} km"
    
    lap_raw = summary.equivalent_hours_laptop
    if lap_raw < 0.001: lap_disp = f"{lap_raw * 3600000:.3g} ms"
    elif lap_raw < 1:   lap_disp = f"{lap_raw * 60:.3g} min"
    else:               lap_disp = f"{smart_num(lap_raw)} h"
    
    chg_raw = summary.equivalent_smartphone_charges
    if chg_raw < 0.001: chg_disp = f"{chg_raw * 1000:.3g} m%"
    else:               chg_disp = f"{smart_num(chg_raw)} charges"

    kpi_data = [
        ("Total Carbon", v_co2, u_co2),
        ("Energy Draw",  v_e,   u_e),
        ("Runtime",      v_d,   u_d),
        ("≈ Driving",    km_disp,  ""),
        ("≈ Laptop",     lap_disp, ""),
        ("≈ Phone",      chg_disp, ""),
    ]
    story.append(_kpi_table(kpi_data))
    story.append(Spacer(1, 0.5 * cm))

    # ── Charts ────────────────────────────────────────────────────────────────
    story.append(_section_title("Emissions Visualisation", styles))
    bar = _bar_chart(summary, analysis.cell_breakdown)
    pie = _pie_chart(summary)
    chart_tbl = Table([[bar, pie]], colWidths=[14 * cm, 6 * cm])
    chart_tbl.setStyle(TableStyle([
        ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
        ("LEFTPADDING",  (0, 0), (-1, -1), 0),
        ("RIGHTPADDING", (0, 0), (-1, -1), 0),
    ]))
    story.append(chart_tbl)
    story.append(Spacer(1, 0.4 * cm))

    # ── Cell breakdown table ──────────────────────────────────────────────────
    story.append(_section_title("Cell-Level Component Breakdown", styles))
    th_style = ParagraphStyle("th", fontName="Helvetica-Bold", fontSize=6.5,
                               textColor=GRAY, leading=9)
    td_style = ParagraphStyle("td", fontName="Helvetica", fontSize=7,
                               textColor=WHITE, leading=10)
    sub_s    = ParagraphStyle("sub_s", fontName="Helvetica", fontSize=6,
                               textColor=GRAY_D, leading=8)
    mono_s   = ParagraphStyle("mono_s", fontName="Courier", fontSize=6.5,
                               textColor=GRAY_D, leading=9)

    cell_data = [[
        _para("Cell",        th_style),
        _para("Type",        th_style),
        _para("Dur.",        th_style),
        _para("CPU Engy",    th_style),
        _para("RAM Engy",    th_style),
        _para("GPU Engy",    th_style),
        _para("Total CO₂",   th_style),
        _para("Code",        th_style),
    ]]
    for c in analysis.cell_breakdown:
        v_co2, u_co2 = fmt_co2(c.co2_grams)
        v_d, u_d     = fmt_dur(c.duration_seconds)
        
        v_cpu, u_cpu = fmt_energy(c.cpu_energy_kwh or 0)
        v_ram, u_ram = fmt_energy(c.ram_energy_kwh or 0)
        v_gpu, u_gpu = fmt_energy(c.gpu_energy_kwh or 0)
        
        pw_cpu = f"<br/><font color='#475569'>{c.cpu_power_w:.1f}W</font>" if (c.cpu_power_w or 0) > 0 else ""
        pw_ram = f"<br/><font color='#475569'>{c.ram_power_w:.1f}W</font>" if (c.ram_power_w or 0) > 0 else ""
        pw_gpu = f"<br/><font color='#475569'>{c.gpu_power_w:.1f}W</font>" if (c.gpu_power_w or 0) > 0 else ""

        gpu_val = f"{v_gpu} {u_gpu}{pw_gpu}" if (c.gpu_energy_kwh or 0) > 0 else "—"

        cell_data.append([
            _para(c.cell_label,                 td_style),
            _para(c.cell_type[:4].upper(),      td_style),  # TRNL / TEST / PREP
            _para(f"{v_d} {u_d}",               td_style),
            _para(f"{v_cpu} {u_cpu}{pw_cpu}",   td_style),
            _para(f"{v_ram} {u_ram}{pw_ram}",   td_style),
            _para(gpu_val,                      td_style),
            _para(f"<b><font color='#a855f7'>{v_co2}</font></b> {u_co2}", td_style),
            _para((c.source_preview or "")[:40].replace('\n', ' '), mono_s),
        ])

    cw = [1.6*cm, 1.3*cm, 1.6*cm, 2.3*cm, 2.3*cm, 2.3*cm, 2.3*cm, 3.3*cm]
    cell_tbl = Table(cell_data, colWidths=cw, repeatRows=1)
    cell_tbl.setStyle(TableStyle([
        ("BACKGROUND",    (0, 0), (-1, 0),  SURFACE),
        ("LINEBELOW",     (0, 0), (-1, 0),  0.5, BORDER),
        ("LINEBELOW",     (0, 1), (-1, -1), 0.3, BORDER),
        ("ROWBACKGROUNDS",(0, 1), (-1, -1), [BG, SURFACE]),
        ("TOPPADDING",    (0, 0), (-1, -1), 5),
        ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
        ("LEFTPADDING",   (0, 0), (-1, -1), 4),
        ("RIGHTPADDING",  (0, 0), (-1, -1), 4),
        ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
    ]))
    story.append(cell_tbl)
    story.append(Spacer(1, 0.4 * cm))

    # ── Static analysis + hardware ────────────────────────────────────────────
    story.append(_section_title("Notebook & Hardware Analysis", styles))

    def _info_block(items: list) -> Table:
        rows = [[
            _para(k, ParagraphStyle("ik", fontName="Helvetica",   fontSize=7.5, textColor=GRAY_D, leading=11)),
            _para(v, ParagraphStyle("iv", fontName="Helvetica-Bold",fontSize=7.5, textColor=WHITE, leading=11)),
        ] for k, v in items]
        t = Table(rows, colWidths=[5 * cm, 9 * cm])
        t.setStyle(TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), SURFACE),
            ("LINEBELOW",     (0, 0), (-1, -2), 0.3, BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (-1, -1), 10),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
            ("BOX",           (0, 0), (-1, -1), 0.5, BORDER),
        ]))
        return t

    patterns = ", ".join(static.detected_patterns) if static.detected_patterns else "none"
    story.append(_info_block([
        ("Framework",        static.framework),
        ("Model type",       static.model_type),
        ("Complexity tier",  static.complexity_tier.upper()),
        ("Training cells",   str(len(static.training_cell_indices))),
        ("Detected patterns",patterns),
    ]))
    story.append(Spacer(1, 0.3 * cm))
    story.append(_info_block([
        ("CPU",     hardware.cpu_model),
        ("Cores",   str(hardware.cpu_count)),
        ("RAM",     f"{hardware.ram_gb} GB"),
        ("GPU",     hardware.gpu_model or "Not detected"),
        ("OS",      hardware.os),
    ]))
    story.append(Spacer(1, 0.4 * cm))

    # ── AI Suggestions ────────────────────────────────────────────────────────
    story.append(_section_title("AI Suggestions to Reduce Footprint", styles))

    # Insight box
    story.append(Table(
        [[_para(suggestions.summary_insight, styles["insight"])]],
        colWidths=[A4[0] - 4 * cm],
        style=TableStyle([
            ("BACKGROUND",    (0, 0), (-1, -1), PURPLE_D),
            ("TOPPADDING",    (0, 0), (-1, -1), 12),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 12),
            ("LEFTPADDING",   (0, 0), (-1, -1), 14),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 14),
            ("BOX",           (0, 0), (-1, -1), 0.5, PURPLE),
        ]),
    ))
    story.append(Spacer(1, 0.3 * cm))

    IMPACT_COLOR = {"high": RED, "medium": AMBER, "low": INDIGO}

    for sug in suggestions.suggestions:
        accent = IMPACT_COLOR.get(sug.impact, INDIGO)

        sug_rows = [
            [_para(sug.title,       styles["sug_title"]),
             _para(sug.impact.upper() + " IMPACT",
                   ParagraphStyle("imp", fontName="Helvetica-Bold", fontSize=7,
                                  textColor=accent, leading=10, alignment=TA_RIGHT))],
            [_para(sug.description, styles["body"]), ""],
        ]
        if sug.estimated_savings:
            sug_rows.append([
                _para(f"Est. savings: {sug.estimated_savings}",
                      ParagraphStyle("sv", fontName="Helvetica", fontSize=8,
                                     textColor=PURPLE_L, leading=11)), ""
            ])
        sug_rows.append([
            _para(f"Ref: {sug.source_reference}",
                  ParagraphStyle("ref", fontName="Helvetica", fontSize=7,
                                 textColor=GRAY_D, leading=10)), ""
        ])

        W = A4[0] - 4 * cm
        tbl = Table(sug_rows, colWidths=[W * 0.72, W * 0.28])
        tbl.setStyle(TableStyle([
            ("SPAN",          (0, 1), (-1, 1)),
            ("SPAN",          (0, 2), (-1, 2)),
            ("SPAN",          (0, 3), (-1, 3)),
            ("BACKGROUND",    (0, 0), (-1, -1), SURFACE),
            ("LINEAFTER",     (0, 0), (0, 0),   0,    colors.transparent),
            ("LINEBEFORE",    (0, 0), (0, -1),  2.5,  accent),
            ("BOX",           (0, 0), (-1, -1), 0.5,  BORDER),
            ("TOPPADDING",    (0, 0), (-1, -1), 7),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
            ("LEFTPADDING",   (0, 0), (-1, -1), 12),
            ("RIGHTPADDING",  (0, 0), (-1, -1), 10),
            ("VALIGN",        (0, 0), (-1, -1), "TOP"),
        ]))
        story.append(KeepTogether(tbl))
        story.append(Spacer(1, 0.2 * cm))

    # ── Footer ─────────────────────────────────────────────────────────────────
    story.append(Spacer(1, 0.6 * cm))
    story.append(_hr())
    story.append(_para(
        f"Generated by GreenTrace · {analysis.notebook_name} · "
        f"{analysis.timestamp[:19].replace('T', ' ')} UTC",
        ParagraphStyle("footer", fontName="Helvetica", fontSize=7,
                       textColor=GRAY_D, alignment=TA_CENTER),
    ))

    # ── Background page canvas ─────────────────────────────────────────────────
    def _dark_canvas(canvas, doc):
        canvas.saveState()
        canvas.setFillColor(BG)
        canvas.rect(0, 0, A4[0], A4[1], fill=1, stroke=0)
        canvas.restoreState()

    doc.build(story, onFirstPage=_dark_canvas, onLaterPages=_dark_canvas)
    return output_path
