"""
Static analysis of .ipynb notebooks using Python AST.
Detects: framework, model type, training/testing cells, estimated complexity.
"""

import ast
import re
import nbformat
from typing import List, Dict, Tuple, Optional
from models.schemas import StaticAnalysis


# ──────────────────────────────────────────────
# Pattern libraries
# ──────────────────────────────────────────────

FRAMEWORK_PATTERNS = {
    "pytorch":       [r"\btorch\b", r"\bnn\.Module\b", r"from torch", r"import torch"],
    "tensorflow":    [r"\btensorflow\b", r"\btf\.", r"from tensorflow", r"import tensorflow"],
    "keras":         [r"\bkeras\b", r"from keras", r"import keras", r"model\.add\("],
    "sklearn":       [r"sklearn", r"from sklearn", r"import sklearn"],
    "huggingface":   [r"\btransformers\b", r"from transformers", r"AutoModel", r"Trainer\("],
    "xgboost":       [r"\bxgboost\b", r"import xgboost", r"XGBClassifier", r"XGBRegressor"],
    "lightgbm":      [r"\blightgbm\b", r"import lightgbm", r"LGBMClassifier"],
    "fastai":        [r"\bfastai\b", r"from fastai"],
    "jax":           [r"\bjax\b", r"import jax", r"from jax"],
}

MODEL_TYPE_PATTERNS = {
    "Transformer / BERT / GPT": [
        r"BertModel", r"GPT2", r"GPTNeo", r"AutoModel", r"T5", r"RoBERTa",
        r"DistilBert", r"TransformerEncoder", r"nn\.Transformer",
        r"nn\.MultiheadAttention", r"Attention\(",
    ],
    "CNN": [
        r"Conv2d", r"Conv1d", r"conv2d", r"MaxPool", r"ResNet", r"VGG",
        r"EfficientNet", r"MobileNet", r"ConvNet",
    ],
    "RNN / LSTM / GRU": [
        r"\bLSTM\b", r"\bGRU\b", r"\bRNN\b", r"nn\.LSTM", r"nn\.GRU",
        r"SimpleRNN", r"Bidirectional",
    ],
    "MLP / Dense": [
        r"nn\.Linear", r"Dense\(", r"Sequential\(", r"fc\d+",
        r"fully.connected", r"hidden_layer",
    ],
    "Random Forest": [r"RandomForest", r"ExtraTree"],
    "Gradient Boosting": [r"GradientBoosting", r"XGBClassifier", r"XGBRegressor", r"LGBMClassifier"],
    "SVM": [r"\bSVC\b", r"\bSVR\b", r"SupportVector"],
    "Linear / Logistic Regression": [r"LinearRegression", r"LogisticRegression", r"Ridge\(", r"Lasso\("],
    "Decision Tree": [r"DecisionTree"],
    "KNN": [r"KNeighbors", r"KNN"],
    "Autoencoder": [r"Autoencoder", r"autoencoder", r"encoder.*decoder"],
    "GAN": [r"GAN", r"Discriminator", r"Generator", r"adversarial"],
    "Diffusion": [r"Diffusion", r"DDPM", r"UNet"],
}

TRAINING_PATTERNS = [
    r"\.fit\(", r"trainer\.train\(", r"\.train\(", r"optimizer\.step\(",
    r"loss\.backward\(", r"for epoch", r"for.*epoch", r"model\.train\(\)",
    r"clf\.fit\(", r"net\.fit\(", r"regressor\.fit\(",
    r"backward\(\)", r"zero_grad\(",
]

TESTING_PATTERNS = [
    r"\.predict\(", r"\.evaluate\(", r"trainer\.evaluate\(", r"\.score\(",
    r"model\.eval\(\)", r"torch\.no_grad\(\)", r"with no_grad",
    r"test_acc", r"accuracy_score", r"classification_report",
    r"confusion_matrix", r"f1_score", r"roc_auc",
]

PREPROCESSING_PATTERNS = [
    r"pd\.read", r"np\.load", r"DataLoader", r"Dataset\(",
    r"train_test_split", r"StandardScaler", r"MinMaxScaler",
    r"ImageDataGenerator", r"transforms\.", r"tokenizer\.",
    r"\.fillna\(", r"\.dropna\(", r"\.astype\(",
]

# FLOP estimates per complexity tier (rough order of magnitude)
COMPLEXITY_FLOPS = {
    "light":      1e7,
    "medium":     1e9,
    "heavy":      1e11,
    "very_heavy": 1e13,
}

MODEL_COMPLEXITY_MAP = {
    "Transformer / BERT / GPT": "very_heavy",
    "CNN":                       "heavy",
    "RNN / LSTM / GRU":          "heavy",
    "MLP / Dense":               "medium",
    "Random Forest":             "medium",
    "Gradient Boosting":         "medium",
    "SVM":                       "medium",
    "Linear / Logistic Regression": "light",
    "Decision Tree":             "light",
    "KNN":                       "light",
    "Autoencoder":               "heavy",
    "GAN":                       "very_heavy",
    "Diffusion":                 "very_heavy",
    "Unknown":                   "medium",
}


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _match_patterns(source: str, patterns: List[str]) -> bool:
    return any(re.search(p, source) for p in patterns)


def _detect_framework(all_source: str) -> str:
    scores = {}
    for fw, pats in FRAMEWORK_PATTERNS.items():
        score = sum(1 for p in pats if re.search(p, all_source))
        if score:
            scores[fw] = score
    if not scores:
        return "Unknown"
    return max(scores, key=scores.get)


def _detect_model_type(all_source: str) -> str:
    for mtype, pats in MODEL_TYPE_PATTERNS.items():
        if _match_patterns(all_source, pats):
            return mtype
    return "Unknown"


def _classify_cell(source: str) -> str:
    if _match_patterns(source, TRAINING_PATTERNS):
        return "training"
    if _match_patterns(source, TESTING_PATTERNS):
        return "testing"
    if _match_patterns(source, PREPROCESSING_PATTERNS):
        return "preprocessing"
    return "other"


def _extract_patterns(all_source: str) -> List[str]:
    found = []
    all_patterns = {
        **{k: v for k, v in FRAMEWORK_PATTERNS.items()},
        **{"training_loop": TRAINING_PATTERNS[:3]},
        **{"evaluation": TESTING_PATTERNS[:3]},
    }
    notable = {
        "mixed_precision": [r"amp\.", r"autocast", r"GradScaler", r"fp16", r"bfloat16"],
        "gradient_checkpointing": [r"gradient.checkpoint", r"checkpoint_activations"],
        "early_stopping": [r"EarlyStopping", r"early.stop"],
        "learning_rate_scheduler": [r"LRScheduler", r"lr_scheduler", r"ReduceLROnPlateau", r"CosineAnnealing"],
        "data_augmentation": [r"augment", r"RandomFlip", r"RandomCrop", r"albumentations"],
        "batch_normalization": [r"BatchNorm", r"batch_norm", r"LayerNorm"],
        "dropout": [r"Dropout", r"dropout"],
        "large_batch_size": [r"batch_size\s*=\s*[2-9]\d{2,}"],
        "cpu_only_training": [r"device.*cpu", r"\.cpu\(\)"],
        "gpu_training": [r"\.cuda\(\)", r"device.*cuda", r"\.to\(device\)"],
    }
    for name, pats in notable.items():
        if _match_patterns(all_source, pats):
            found.append(name)
    return found


# ──────────────────────────────────────────────
# Main entry point
# ──────────────────────────────────────────────

def analyze_notebook(notebook_path: str) -> StaticAnalysis:
    nb = nbformat.read(notebook_path, as_version=4)

    training_cells: List[int] = []
    testing_cells: List[int] = []
    preprocessing_cells: List[int] = []
    all_source_parts: List[str] = []

    # IMPORTANT: Use a sequential code-cell index (not the raw nb.cells index).
    # nb.cells includes markdown, raw, and code cells. The notebook_runner maps
    # cells using the same sequential code-cell index so classifications must match.
    code_cell_idx = 0
    for cell in nb.cells:
        if cell.cell_type != "code":
            continue
        src = cell.source
        all_source_parts.append(src)
        ctype = _classify_cell(src)
        if ctype == "training":
            training_cells.append(code_cell_idx)
        elif ctype == "testing":
            testing_cells.append(code_cell_idx)
        elif ctype == "preprocessing":
            preprocessing_cells.append(code_cell_idx)
        code_cell_idx += 1

    all_source = "\n".join(all_source_parts)

    framework   = _detect_framework(all_source)
    model_type  = _detect_model_type(all_source)
    complexity  = MODEL_COMPLEXITY_MAP.get(model_type, "medium")
    est_flops   = COMPLEXITY_FLOPS[complexity]
    patterns    = _extract_patterns(all_source)

    return StaticAnalysis(
        framework=framework,
        model_type=model_type,
        has_training=bool(training_cells),
        has_testing=bool(testing_cells),
        training_cell_indices=training_cells,
        testing_cell_indices=testing_cells,
        preprocessing_cell_indices=preprocessing_cells,
        estimated_flops=est_flops,
        detected_patterns=patterns,
        complexity_tier=complexity,
    )
