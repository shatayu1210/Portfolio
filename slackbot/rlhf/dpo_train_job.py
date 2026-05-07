"""
dpo_train_job.py — RunPod serverless handler for DPO training.

This script is what actually runs ON the RunPod GPU pod.
It is deployed as a Docker image to RunPod serverless.

Input (from RunPod job payload):
  hf_token        : str
  dataset_repo    : str   (e.g. "autobot298/autobot-feedback")
  base_model_repo : str   (e.g. "autobot298/autobot-reasoner-7b")
  adapter_repo    : str   (e.g. "autobot298/autobot-reasoner-dpo-adapter")
  num_epochs      : int   (default 3)
  max_steps       : int   (optional, overrides epochs for quick test)
"""
import os
import json
import runpod
import torch

from datasets import load_dataset, Dataset
from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from trl import DPOTrainer, DPOConfig


def build_dpo_dataset(raw_records: list[dict], tokenizer) -> Dataset:
    """Convert HF feedback records to TRL DPO format: prompt / chosen / rejected."""
    rows = []
    for r in raw_records:
        if not r.get("labeled") or not r.get("chosen_response") or not r.get("bad_response"):
            continue
        # Strip the Qwen chat template down to just the user content
        prompt_raw = r["prompt"]
        if "<|im_start|>user" in prompt_raw:
            user_content = prompt_raw.split("<|im_start|>user\n")[1].split("<|im_end|>")[0].strip()
        else:
            user_content = prompt_raw

        rows.append({
            "prompt":   user_content,
            "chosen":   r["chosen_response"].strip(),
            "rejected": r["bad_response"].strip(),
        })
    print(f"[DPO] Built dataset with {len(rows)} pairs")
    return Dataset.from_list(rows)


def handler(job: dict) -> dict:
    """RunPod serverless entry point."""
    inp = job.get("input", {})

    hf_token        = inp.get("hf_token")
    dataset_repo    = inp.get("dataset_repo", "autobot298/autobot-feedback")
    base_model_repo = inp.get("base_model_repo")
    adapter_repo    = inp.get("adapter_repo", "autobot298/autobot-reasoner-dpo-adapter")
    num_epochs      = int(inp.get("num_epochs", 3))
    max_steps       = inp.get("max_steps")  # None means use epochs

    print(f"[DPO] Starting training job")
    print(f"  Base model:   {base_model_repo}")
    print(f"  Dataset repo: {dataset_repo}")
    print(f"  Adapter repo: {adapter_repo}")
    print(f"  Epochs:       {num_epochs}  |  Max steps: {max_steps}")

    # ── 1. Load DPO dataset ───────────────────────────────────────────────────
    print("[DPO] Loading dataset from HF Hub...")
    raw_ds  = load_dataset(dataset_repo, split="train", token=hf_token)
    records = [dict(r) for r in raw_ds.filter(
        lambda r: r["labeled"] and not r["retrained"] and r["feedback_type"] == "negative"
    )]

    if len(records) < 5:
        return {"success": False, "error": f"Not enough labeled pairs: {len(records)} (need ≥5)"}

    # ── 2. Load tokenizer ─────────────────────────────────────────────────────
    print("[DPO] Loading tokenizer...")
    tokenizer = AutoTokenizer.from_pretrained(base_model_repo, token=hf_token)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token

    dpo_dataset = build_dpo_dataset(records, tokenizer)

    # ── 3. Load base model in 4-bit ───────────────────────────────────────────
    print("[DPO] Loading base model (4-bit)...")
    bnb_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
        bnb_4bit_compute_dtype=torch.bfloat16,
    )
    model = AutoModelForCausalLM.from_pretrained(
        base_model_repo,
        quantization_config=bnb_config,
        device_map="auto",
        token=hf_token,
    )
    model = prepare_model_for_kbit_training(model)

    # ── 4. LoRA config ────────────────────────────────────────────────────────
    lora_config = LoraConfig(
        r=16,
        lora_alpha=32,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_dropout=0.05,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    # ── 5. DPO Training config ────────────────────────────────────────────────
    output_dir = "/workspace/dpo_output"
    train_args = DPOConfig(
        output_dir=output_dir,
        num_train_epochs=num_epochs,
        max_steps=max_steps if max_steps else -1,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=5e-5,
        beta=0.1,                        # DPO KL penalty coefficient
        max_length=1024,
        max_prompt_length=512,
        fp16=False,
        bf16=True,
        logging_steps=5,
        save_strategy="no",
        report_to="none",
        remove_unused_columns=False,
    )

    # ── 6. Train ─────────────────────────────────────────────────────────────
    print("[DPO] Starting DPO training...")
    trainer = DPOTrainer(
        model=model,
        ref_model=None,                  # TRL creates a frozen copy automatically
        args=train_args,
        train_dataset=dpo_dataset,
        tokenizer=tokenizer,
    )
    trainer.train()
    print("[DPO] Training complete!")

    # ── 7. Save and push adapter ──────────────────────────────────────────────
    adapter_path = f"{output_dir}/adapter"
    model.save_pretrained(adapter_path)
    tokenizer.save_pretrained(adapter_path)
    print(f"[DPO] Adapter saved locally to {adapter_path}")

    print(f"[DPO] Pushing adapter to {adapter_repo}...")
    model.push_to_hub(adapter_repo, token=hf_token, commit_message=f"DPO adapter — {num_epochs} epochs, {len(records)} pairs")
    tokenizer.push_to_hub(adapter_repo, token=hf_token)
    print(f"[DPO] ✅ Adapter pushed to {adapter_repo}")

    return {
        "success":        True,
        "pairs_trained":  len(records),
        "epochs":         num_epochs,
        "adapter_repo":   adapter_repo,
    }


# RunPod serverless entry point
runpod.serverless.start({"handler": handler})
