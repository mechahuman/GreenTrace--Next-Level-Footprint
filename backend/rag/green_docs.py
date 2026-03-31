"""
Curated green-AI reference documents embedded as structured text chunks.
These are ingested into ChromaDB for RAG-based suggestion generation.

Sources: Strubell et al. 2019, Patterson et al. 2021, Schwartz et al. 2020,
         CodeCarbon paper 2021, Green Software Foundation, Hugging Face docs,
         PyTorch and TensorFlow optimization guides.
"""

DOCUMENTS = [
    {
        "id": "strubell_2019_energy_nlp",
        "title": "Energy and Policy Considerations for Deep Learning in NLP",
        "content": """
Training large NLP models has enormous energy costs. Strubell et al. (2019) found that
training a single large Transformer model with neural architecture search can emit as much
CO2 as five cars over their entire lifetime (~284 tonnes CO2eq). Even training BERT-base
once emits roughly 1438 lbs of CO2.

Key findings:
- Hyperparameter tuning multiplies emissions by 10–100x over a single training run.
- Larger model architectures (more layers, more attention heads) scale non-linearly in energy.
- The type of hardware matters: a single V100 GPU performs a task using far less energy than 64 K80 GPUs.

Recommendations from this work:
1. Report training time and sensitivity to hyperparameters alongside accuracy metrics.
2. Prefer hardware accelerators (TPUs, V100+) over older GPU generations.
3. Reuse pretrained models with fine-tuning instead of training from scratch.
4. Use neural architecture search only when strictly necessary; prefer proven architectures.
""",
        "tags": ["training_cost", "transformers", "nlp", "hardware"]
    },
    {
        "id": "patterson_2021_carbon_ml",
        "title": "Carbon Emissions and Large Neural Network Training (Google, 2021)",
        "content": """
Patterson et al. (2021) analyzed the carbon footprint of several landmark ML models.
They identified four major levers to reduce ML carbon footprint:

1. Model architecture efficiency: Sparse models (e.g., Switch Transformer) can achieve
   similar accuracy with 10x lower energy by activating only relevant parameters per token.
   Prefer architectures designed for efficiency like EfficientNet, MobileNet, DistilBERT.

2. Processor type: TPUs and modern A100/H100 GPUs achieve 2–5x better performance-per-watt
   compared to older GPU generations. Cloud TPU v4 pods showed 10x better efficiency for
   transformer training compared to GPU clusters of similar performance.

3. Data center energy source: Training in a data center powered by 100% renewable energy
   (e.g., Finland, Oregon, Iowa) can reduce CO2eq by 100x versus coal-heavy grids.

4. Geographic location of compute: Grid carbon intensity varies enormously:
   - France: ~50 gCO2/kWh (nuclear)
   - Norway: ~26 gCO2/kWh (hydro)
   - India: ~708 gCO2/kWh (coal-heavy)
   - Poland: ~750 gCO2/kWh (coal-heavy)
   Running workloads in low-carbon regions can cut footprint by 10x.
""",
        "tags": ["hardware", "region", "efficiency", "architecture"]
    },
    {
        "id": "mixed_precision_training",
        "title": "Mixed Precision Training for Energy Efficiency",
        "content": """
Mixed precision training uses FP16 (16-bit floating point) for forward/backward passes
while keeping FP32 master weights for optimizer updates. This technique:

- Reduces memory bandwidth by 2x, allowing larger batch sizes.
- Speeds up matrix multiplications on modern GPUs (Tensor Cores) by 2–8x.
- Reduces energy consumption by 30–50% for the same number of training steps.
- Is natively supported in PyTorch via torch.cuda.amp.autocast() and GradScaler,
  and in TensorFlow via tf.keras.mixed_precision.set_global_policy('mixed_float16').

How to implement in PyTorch:
```python
from torch.cuda.amp import autocast, GradScaler
scaler = GradScaler()
for batch in dataloader:
    optimizer.zero_grad()
    with autocast():
        output = model(batch)
        loss = criterion(output, target)
    scaler.scale(loss).backward()
    scaler.step(optimizer)
    scaler.update()
```

BF16 (bfloat16) is often preferable to FP16 on A100/H100 GPUs and TPUs as it has
the same dynamic range as FP32 and is more numerically stable.
""",
        "tags": ["mixed_precision", "fp16", "pytorch", "tensorflow", "energy_reduction"]
    },
    {
        "id": "gradient_checkpointing",
        "title": "Gradient Checkpointing to Reduce Memory and Energy",
        "content": """
Gradient checkpointing (also called activation recomputation) trades computation for memory.
Instead of storing all intermediate activations during the forward pass, only a subset
(checkpoints) are saved. During backpropagation, the missing activations are recomputed
from the nearest checkpoint.

Benefits:
- Reduces GPU memory by up to 60–70%, allowing training of much larger models
  on the same hardware, or using larger batch sizes.
- Larger batch sizes reduce the number of gradient updates needed, reducing total
  training steps and energy consumption.
- Enables training models that would otherwise not fit on available GPUs, avoiding
  the need for more expensive multi-GPU setups.

Energy impact: By enabling larger batches, gradient checkpointing can reduce total
wall-clock training time by 20–40% while using ~10–20% more FLOPs per step (due to
recomputation). Net energy impact is typically negative (saves energy).

PyTorch implementation:
```python
from torch.utils.checkpoint import checkpoint_sequential
output = checkpoint_sequential(model_layers, segments=4, input=x)
```

HuggingFace Transformers:
```python
model.gradient_checkpointing_enable()
```
""",
        "tags": ["memory_efficiency", "batch_size", "pytorch", "huggingface"]
    },
    {
        "id": "early_stopping",
        "title": "Early Stopping: A Simple but Powerful Carbon-Saving Strategy",
        "content": """
Early stopping halts training when the validation metric stops improving, preventing
wasteful extra epochs that consume energy without improving the model.

Energy savings: Across a survey of common ML tasks, early stopping reduces total
training epochs by 20–60% on average. For a model trained over 100 epochs, early
stopping typically activates around epoch 40–70, saving 30–60 epochs of compute.

Best practices:
- Monitor validation loss (or relevant metric) every N steps, not every epoch,
  to avoid missing the optimal stopping point.
- Use a patience parameter of 5–15 epochs to avoid stopping prematurely due to
  noisy validation curves.
- Restore best weights after stopping to ensure optimal model quality.

Sklearn implementation:
```python
# Use early_stopping=True in gradient boosting models
GradientBoostingClassifier(n_estimators=1000, validation_fraction=0.1,
                            n_iter_no_change=10, tol=1e-4)
```

PyTorch with a callback pattern:
```python
class EarlyStopping:
    def __init__(self, patience=10):
        self.patience = patience
        self.best = float('inf')
        self.counter = 0
    def __call__(self, val_loss):
        if val_loss < self.best:
            self.best = val_loss
            self.counter = 0
        else:
            self.counter += 1
        return self.counter >= self.patience
```
""",
        "tags": ["early_stopping", "training_efficiency", "sklearn", "pytorch"]
    },
    {
        "id": "model_quantization",
        "title": "Model Quantization: Smaller Models, Less Energy",
        "content": """
Quantization reduces the numerical precision of model weights and/or activations
from FP32 to INT8 or INT4. This dramatically reduces model size, inference time,
and energy consumption.

Types of quantization:
1. Post-training quantization (PTQ): Apply after training, no retraining needed.
   Fast to apply, slight accuracy loss (0.5–2% typical).
2. Quantization-aware training (QAT): Simulate quantization during training.
   Better accuracy than PTQ, especially for aggressive INT4 quantization.
3. Dynamic quantization: Weights are quantized to INT8, activations are quantized
   dynamically at runtime. Good for LSTM/Transformer models.

Energy impact:
- INT8 inference is 2–4x faster and uses 2–4x less energy than FP32.
- INT4 can achieve 4–8x speedup with modern hardware support (NVIDIA H100, Apple M-series).
- On edge devices, quantized models can enable running locally vs cloud, saving network energy.

PyTorch dynamic quantization:
```python
import torch.quantization
quantized_model = torch.quantization.quantize_dynamic(
    model, {torch.nn.Linear, torch.nn.LSTM}, dtype=torch.qint8
)
```

HuggingFace with bitsandbytes:
```python
from transformers import AutoModelForCausalLM
model = AutoModelForCausalLM.from_pretrained(name, load_in_8bit=True)
```
""",
        "tags": ["quantization", "inference", "model_compression", "pytorch", "huggingface"]
    },
    {
        "id": "pruning_techniques",
        "title": "Model Pruning to Reduce Compute and Carbon",
        "content": """
Pruning removes redundant weights or entire neurons/filters from a neural network,
reducing its size and inference cost without significant accuracy loss.

Types of pruning:
1. Unstructured pruning: Remove individual weights (set to zero). Achieves high sparsity
   (80–95%) but requires sparse computation support for energy savings.
2. Structured pruning: Remove entire neurons, attention heads, or convolutional filters.
   Compatible with standard dense hardware, achieves real speedups.
3. Iterative pruning + fine-tuning: Prune gradually, fine-tuning between rounds.
   Better accuracy preservation than one-shot pruning.

Energy impact: Removing 50% of parameters typically reduces inference energy by 30–50%,
depending on hardware support for sparse operations.

PyTorch structured pruning (remove attention heads in Transformers):
```python
import torch.nn.utils.prune as prune
prune.l1_unstructured(module, name='weight', amount=0.3)
# After pruning, make it permanent:
prune.remove(module, 'weight')
```

Practical tips:
- For CNNs, prune filters with lowest L1 norm.
- For Transformers, prune attention heads with lowest mean attention weight.
- Use the Lottery Ticket Hypothesis: small, sparse networks trained from scratch
  can match the accuracy of large dense networks.
""",
        "tags": ["pruning", "model_compression", "inference_efficiency"]
    },
    {
        "id": "efficient_data_loading",
        "title": "Efficient Data Pipelines: Reducing Idle GPU Time",
        "content": """
A frequently overlooked source of wasted energy is GPU idle time caused by slow
data loading. If the GPU is waiting for data, it is consuming power without doing useful work.

Optimization strategies:

1. Use multiple DataLoader workers:
```python
DataLoader(dataset, num_workers=4, pin_memory=True, prefetch_factor=2)
```

2. Pin memory for faster CPU→GPU transfers:
```python
DataLoader(dataset, pin_memory=True)  # PyTorch
```

3. Use memory-mapped datasets for large files:
```python
dataset = np.memmap('data.npy', dtype='float32', mode='r')
```

4. Preprocess and cache features:
   - Store tokenized text or extracted features on disk.
   - Use HDF5 or Arrow (Hugging Face datasets) for fast random access.

5. Profile your pipeline to find the bottleneck:
```python
import torch.profiler
with torch.profiler.profile() as prof:
    train_one_epoch()
print(prof.key_averages().table(sort_by='self_cpu_time_total'))
```

Energy impact: Reducing GPU idle time from 30% to 5% of total training time
can cut wall-clock training time (and energy) by ~25%.
""",
        "tags": ["data_pipeline", "gpu_utilization", "pytorch"]
    },
    {
        "id": "transfer_learning",
        "title": "Transfer Learning: Reuse Instead of Retrain",
        "content": """
Transfer learning is one of the most impactful ways to reduce ML carbon footprint.
Instead of training a model from scratch, start from a pretrained model and fine-tune
on your specific task.

Energy comparison:
- Training BERT-base from scratch: ~1438 lbs CO2eq (Strubell et al.)
- Fine-tuning BERT-base on a classification task: typically 0.5–5 lbs CO2eq
- Reduction: 100–1000x less energy for equivalent or better performance.

Best practices:
1. Always check if a pretrained model exists for your domain/task on Hugging Face Hub,
   PyTorch Hub, or TensorFlow Hub before training from scratch.
2. For image tasks, ResNet50/EfficientNet pretrained on ImageNet cover most domains.
3. For NLP tasks, BERT/RoBERTa/DistilBERT cover most classification and extraction tasks.
4. For generation tasks, fine-tuning GPT-2 or T5 is far more efficient than training from scratch.
5. Use LoRA (Low-Rank Adaptation) for extremely parameter-efficient fine-tuning of large models:
   only 0.1–1% of parameters are updated, reducing energy by 10–100x vs full fine-tuning.

```python
# HuggingFace PEFT / LoRA example
from peft import get_peft_model, LoraConfig
config = LoraConfig(r=16, lora_alpha=32, target_modules=["q_proj","v_proj"])
model = get_peft_model(base_model, config)
```
""",
        "tags": ["transfer_learning", "fine_tuning", "lora", "huggingface", "energy_reduction"]
    },
    {
        "id": "batch_size_optimization",
        "title": "Optimizing Batch Size for Energy Efficiency",
        "content": """
Batch size has a non-obvious relationship with energy efficiency:

- Too small: GPU underutilized, many gradient updates needed, high overhead.
- Too large: More memory required, may need gradient accumulation or smaller model.
- Optimal range: Usually 64–512 for modern GPUs on most tasks.

Gradient accumulation allows using effectively large batch sizes without large memory:
```python
accumulation_steps = 8
optimizer.zero_grad()
for i, batch in enumerate(dataloader):
    loss = model(batch) / accumulation_steps
    loss.backward()
    if (i + 1) % accumulation_steps == 0:
        optimizer.step()
        optimizer.zero_grad()
```
This accumulates gradients over 8 mini-batches before updating, simulating a batch
size 8x larger.

Linear scaling rule: When doubling the batch size, multiply the learning rate by 2.
This keeps training time roughly constant while using GPU memory more efficiently.

Energy impact: Increasing batch size from 32 to 256 (with LR scaling) typically
reduces total training time by 30–60% on the same hardware, proportionally reducing energy.
""",
        "tags": ["batch_size", "gradient_accumulation", "gpu_utilization"]
    },
    {
        "id": "learning_rate_scheduling",
        "title": "Learning Rate Schedulers to Converge Faster",
        "content": """
An appropriate learning rate schedule can significantly reduce the number of training
steps needed to converge, directly reducing energy consumption.

Recommended schedulers:

1. Cosine annealing with warm restarts:
   - Starts high, smoothly decays to near-zero, restarts periodically.
   - Helps escape local minima and converges in fewer epochs than constant LR.
   - Often reduces total training time by 20–40%.

2. One-cycle policy (Leslie Smith):
   - Starts low, rises to max LR (warm-up), then decays with cosine.
   - Enables training with very large LR, significantly reducing epochs needed.
   - Can train ResNet50 on ImageNet in 30 epochs vs standard 90.

3. Linear warmup + cosine decay (standard for Transformers):
   - Prevents training instability early on.
   - Achieves the same validation loss in 20–40% fewer steps than constant LR.

```python
# PyTorch cosine annealing
scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(optimizer, T_max=50)

# One-cycle policy
scheduler = torch.optim.lr_scheduler.OneCycleLR(
    optimizer, max_lr=0.1, steps_per_epoch=len(loader), epochs=30
)
```

Energy impact: Using a proper LR schedule reduces required training epochs by 20–60%
compared to a fixed learning rate, directly proportional to energy savings.
""",
        "tags": ["learning_rate", "convergence", "training_efficiency"]
    },
    {
        "id": "model_selection_efficiency",
        "title": "Choosing Efficient Model Architectures",
        "content": """
Selecting a more efficient model architecture from the start avoids unnecessary energy waste.

Efficiency rankings for common tasks:

Image classification (accuracy/FLOPs ratio, best to worst):
1. EfficientNet-B0 to B7 (best efficiency, Tan & Le 2019)
2. MobileNetV3 (best for mobile/edge)
3. ResNet-18/34 (good baseline, widely supported)
4. VGG (poor efficiency, avoid for new projects)

NLP (accuracy/FLOPs ratio):
1. DistilBERT (97% of BERT accuracy, 60% fewer parameters, 40% less energy)
2. ALBERT (parameter sharing, very memory efficient)
3. TinyBERT (knowledge distillation, 7.5x smaller than BERT)
4. BERT-base (baseline)
5. BERT-large / XLNet (avoid unless accuracy gap is critical)

Tabular data:
1. LightGBM / XGBoost (tree-based, extremely energy efficient vs neural approaches)
2. CatBoost (handles categoricals natively, fast training)
3. TabNet (neural but architecture-aware of tabular structure)
4. MLP on tabular (often overkill; tree methods beat it in most benchmarks)

General principle: Start with the smallest model that achieves your accuracy target.
Scale up only if needed. The smallest EfficientNet that meets your accuracy bar uses
10–100x less energy than an unconstrained search for the best model.
""",
        "tags": ["architecture", "efficientnet", "distilbert", "model_selection"]
    },
    {
        "id": "codecarbon_measurement",
        "title": "Measuring ML Carbon Footprint with CodeCarbon",
        "content": """
CodeCarbon (Lottick et al., 2019; Courty et al., 2021) is an open-source Python library
for tracking the carbon footprint of machine learning code.

It measures:
- CPU energy via Intel RAPL (Intel processors) or TDP estimation
- GPU energy via NVIDIA-SMI (NVIDIA GPUs) or MPS (Apple Silicon)
- RAM energy (estimated from capacity)
- Converts energy to CO2eq using real-time or regional grid intensity data

Installation: pip install codecarbon

Basic usage:
```python
from codecarbon import EmissionsTracker
tracker = EmissionsTracker(country_iso_code="IND")
tracker.start()
# ... your ML code here ...
emissions = tracker.stop()  # returns kg CO2eq
```

Offline decorator usage:
```python
from codecarbon import track_emissions

@track_emissions(country_iso_code="USA")
def train_model():
    # your training code
    pass
```

The reported output includes:
- duration (seconds), emissions (kg CO2eq), energy_consumed (kWh)
- country, region, cloud_provider, cloud_region, cpu_model, gpu_model

For cloud training, specify the cloud provider and region for accurate grid intensity:
```python
tracker = EmissionsTracker(cloud_provider="aws", cloud_region="us-east-1")
```
""",
        "tags": ["codecarbon", "measurement", "tracking", "tools"]
    },
    {
        "id": "green_software_foundation",
        "title": "Green Software Foundation: Core Principles",
        "content": """
The Green Software Foundation (GSF) defines software sustainability across three pillars:

1. Carbon Efficiency:
   - Emit the least carbon possible for a given unit of work.
   - Key metric: Carbon per functional unit (e.g., gCO2 per inference, per trained model).
   - Demand-shift: Run batch training workloads at night or on weekends when the grid
     has more renewable energy (solar/wind are intermittent).
   - Demand-shape: Reduce work during high-carbon-intensity periods using grid APIs
     (e.g., WattTime, Electricity Maps API).

2. Energy Efficiency:
   - Consume the least energy possible.
   - Avoid idle compute: release GPU resources when not in use.
   - Profile before optimizing: use nsight, torch.profiler, or nvtop to identify
     the actual bottleneck before spending time on micro-optimizations.

3. Hardware Efficiency:
   - Maximize utilization of existing hardware before provisioning more.
   - Prefer hardware with better performance-per-watt (modern GPU generations).
   - Use spot/preemptible instances for training (cheaper and often idle hardware).

SCI Score (Software Carbon Intensity):
   SCI = ((E × I) + M) / R
   - E = Energy consumed
   - I = Grid carbon intensity (gCO2/kWh)
   - M = Embodied carbon (manufacturing cost, amortized over hardware lifetime)
   - R = Functional unit (requests, users, jobs)

Aim to minimize SCI across all three components.
""",
        "tags": ["green_software", "principles", "demand_shifting", "measurement"]
    },
    {
        "id": "knowledge_distillation",
        "title": "Knowledge Distillation: Training Small Models from Large Ones",
        "content": """
Knowledge distillation (Hinton et al., 2015) trains a small 'student' model to mimic
the behavior of a larger 'teacher' model. The student learns from the teacher's
soft probability outputs (which contain richer information than hard labels).

Benefits:
- Produces compact models that achieve 90–97% of the teacher's accuracy at 10–50x
  lower inference cost and energy.
- DistilBERT: 40% smaller, 60% faster, 97% of BERT-base performance.
- TinyBERT: 7.5x smaller, 9.4x faster than BERT-base.

Basic distillation in PyTorch:
```python
import torch.nn.functional as F

def distillation_loss(student_logits, teacher_logits, true_labels, T=4, alpha=0.7):
    # Soft targets loss (KL divergence)
    soft_loss = F.kl_div(
        F.log_softmax(student_logits / T, dim=1),
        F.softmax(teacher_logits / T, dim=1),
        reduction='batchmean'
    ) * (T ** 2)
    # Hard targets loss (standard cross-entropy)
    hard_loss = F.cross_entropy(student_logits, true_labels)
    return alpha * soft_loss + (1 - alpha) * hard_loss
```

When to use:
- You have a trained large model and need to deploy it efficiently.
- You want to reduce ongoing inference carbon footprint.
- You cannot afford to modify the original training pipeline.
""",
        "tags": ["distillation", "model_compression", "inference_efficiency"]
    },
]


def get_all_documents():
    return DOCUMENTS


def get_document_texts():
    return [
        f"Title: {d['title']}\n\nTags: {', '.join(d['tags'])}\n\n{d['content'].strip()}"
        for d in DOCUMENTS
    ]


def get_document_ids():
    return [d["id"] for d in DOCUMENTS]
