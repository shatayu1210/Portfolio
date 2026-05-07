"""
dpo_train_job.py — RunPod serverless handler for DPO training.
Includes AUTO-INSTALL for dependencies to bypass local Docker build issues.
"""
import os
import subprocess
import sys

def install_deps():
    """Install missing dependencies at runtime on the RunPod GPU machine."""
    print("[DPO] Checking/Installing dependencies...")
    deps = ["runpod", "trl>=0.8.6", "peft>=0.10.0", "bitsandbytes>=0.43.0", "transformers>=4.40.0", "datasets>=2.18.0", "accelerate>=0.29.0"]
    try:
        import runpod
        import trl
    except ImportError:
        print(f"[DPO] Dependencies not found. Installing: {deps}")
        subprocess.check_call([sys.executable, "-m", "pip", "install"] + deps)
        print("[DPO] Installation complete.")

# Run installation before anything else
install_deps()

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
    return Dataset.from_list(rows)

def handler(job: dict) -> dict:
    inp = job.get("input", {})
    hf_token        = inp.get("hf_token")
    dataset_repo    = inp.get("dataset_repo", "autobot298/autobot-feedback")
    base_model_repo = inp.get("base_model_repo")
    adapter_repo    = inp.get("adapter_repo", "autobot298/autobot-reasoner-dpo-adapter")
    num_epochs      = int(inp.get("num_epochs", 3))
    max_steps       = inp.get("max_steps")

    print(f"[DPO] Starting training job on {base_model_repo}")

    # 1. Load Dataset
    raw_ds  = load_dataset(dataset_repo, split="train", token=hf_token)
    records = [dict(r) for r in raw_ds.filter(lambda r: r["labeled"] and not r["retrained"])]

    if len(records) < 1:
        return {"success": False, "error": "No labeled pairs found."}

    # 2. Tokenizer
    tokenizer = AutoTokenizer.from_pretrained(base_model_repo, token=hf_token)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    dpo_dataset = build_dpo_dataset(records, tokenizer)

    # 3. Model (4-bit)
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

    # 4. LoRA
    lora_config = LoraConfig(
        r=16, lora_alpha=32, target_modules=["q_proj", "k_proj", "v_proj", "o_proj"],
        lora_dropout=0.05, bias="none", task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)

    # 5. DPO Train
    train_args = DPOConfig(
        output_dir="/workspace/dpo_output",
        num_train_epochs=num_epochs,
        max_steps=max_steps if max_steps else -1,
        per_device_train_batch_size=1,
        gradient_accumulation_steps=4,
        learning_rate=5e-5,
        beta=0.1,
        bf16=True,
        logging_steps=5,
        save_strategy="no",
        report_to="none",
        remove_unused_columns=False,
    )

    trainer = DPOTrainer(
        model=model, ref_model=None, args=train_args,
        train_dataset=dpo_dataset, tokenizer=tokenizer,
        max_length=1024, max_prompt_length=512,
    )
    trainer.train()

    # 6. Push to Hub
    model.push_to_hub(adapter_repo, token=hf_token)
    tokenizer.push_to_hub(adapter_repo, token=hf_token)

    return {"success": True, "pairs": len(records)}

runpod.serverless.start({"handler": handler})
