"""QLoRA fine-tuning script for CleanSQL using chat format (Qwen2.5-Coder-7B-Instruct)."""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from typing import List

import torch
from datasets import Dataset
from peft import LoraConfig, get_peft_model, prepare_model_for_kbit_training
from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
    Trainer,
    TrainingArguments,
    DataCollatorForLanguageModeling,
)

def load_chat_examples(path: Path) -> List[dict]:
    """Load training examples in chat format (messages)."""
    rows = []
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            rows.append(json.loads(line))
    if not rows:
        raise ValueError("Training file is empty")
    return rows


def format_chat_template(messages: List[dict], tokenizer) -> str:
    """Format messages using the tokenizer's chat template."""
    # Qwen2.5 uses chat template
    formatted = tokenizer.apply_chat_template(
        messages,
        tokenize=False,
        add_generation_prompt=False,
    )
    return formatted


def main(args: argparse.Namespace) -> None:
    train_rows = load_chat_examples(Path(args.train_file))
    
    # Load tokenizer
    tokenizer = AutoTokenizer.from_pretrained(args.base_model, trust_remote_code=True)
    if tokenizer.pad_token is None:
        tokenizer.pad_token = tokenizer.eos_token
    tokenizer.padding_side = "right"
    
    # Prepare dataset
    def tokenize_function(examples):
        """Tokenize chat format examples."""
        texts = []
        for row in examples["messages"]:
            formatted = tokenizer.apply_chat_template(
                row,
                tokenize=False,
                add_generation_prompt=False,
            )
            texts.append(formatted)
        
        tokenized = tokenizer(
            texts,
            truncation=True,
            max_length=args.max_length,
            padding="max_length",
        )
        # For causal LM, labels are the same as input_ids
        tokenized["labels"] = tokenized["input_ids"].copy()
        return tokenized
    
    dataset = Dataset.from_list(train_rows)
    tokenized_dataset = dataset.map(
        tokenize_function,
        batched=True,
        remove_columns=dataset.column_names,
    )
    
    # Split train/val if validation file provided
    if args.val_file:
        val_rows = load_chat_examples(Path(args.val_file))
        val_dataset = Dataset.from_list(val_rows)
        val_tokenized = val_dataset.map(
            tokenize_function,
            batched=True,
            remove_columns=val_dataset.column_names,
        )
    else:
        # Use 10% of training data as validation
        split = tokenized_dataset.train_test_split(test_size=0.1, seed=42)
        tokenized_dataset = split["train"]
        val_tokenized = split["test"]
    
    # Load model with QLoRA (using BitsAndBytesConfig for newer transformers)
    from transformers import BitsAndBytesConfig
    
    quantization_config = BitsAndBytesConfig(
        load_in_4bit=True,
        bnb_4bit_compute_dtype=torch.bfloat16,
        bnb_4bit_use_double_quant=True,
        bnb_4bit_quant_type="nf4",
    )
    
    # Try to load on GPU first, fallback to CPU offloading if needed
    try:
        model = AutoModelForCausalLM.from_pretrained(
            args.base_model,
            quantization_config=quantization_config,
            device_map="auto",
            trust_remote_code=True,
            torch_dtype=torch.bfloat16,
        )
    except ValueError as e:
        if "CPU or the disk" in str(e) or "GPU RAM" in str(e):
            # Fallback: allow CPU offloading for some layers
            print("⚠ GPU memory limited. Allowing CPU offloading for some layers...")
            model = AutoModelForCausalLM.from_pretrained(
                args.base_model,
                quantization_config=quantization_config,
                device_map="auto",
                trust_remote_code=True,
                torch_dtype=torch.bfloat16,
                max_memory={0: "20GiB", "cpu": "30GiB"},  # Limit GPU, allow CPU
            )
        else:
            raise
    
    model = prepare_model_for_kbit_training(model)
    
    # LoRA config (optimized for Qwen2.5)
    lora_config = LoraConfig(
        r=args.lora_r,
        lora_alpha=args.lora_alpha,
        target_modules=["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
        lora_dropout=args.lora_dropout,
        bias="none",
        task_type="CAUSAL_LM",
    )
    model = get_peft_model(model, lora_config)
    
    # Data collator
    data_collator = DataCollatorForLanguageModeling(
        tokenizer=tokenizer,
        mlm=False,  # Causal LM, not masked LM
    )
    
    # Training arguments
    training_args = TrainingArguments(
        output_dir=args.output_dir,
        per_device_train_batch_size=args.per_device_train_batch_size,
        gradient_accumulation_steps=args.gradient_accumulation_steps,
        num_train_epochs=args.num_train_epochs,
        learning_rate=args.learning_rate,
        warmup_ratio=0.03,
        logging_steps=10,
        save_strategy="epoch",
        eval_strategy="epoch" if args.val_file or True else "no",
        save_total_limit=2,
        bf16=torch.cuda.is_available() and torch.cuda.is_bf16_supported(),
        fp16=torch.cuda.is_available() and not torch.cuda.is_bf16_supported(),
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        report_to="none",  # Disable wandb/tensorboard for Colab
    )
    
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=tokenized_dataset,
        eval_dataset=val_tokenized if args.val_file or True else None,
        data_collator=data_collator,
    )
    
    print(f"Starting training with {len(tokenized_dataset)} examples...")
    trainer.train()
    
    # Save final model
    model.save_pretrained(args.output_dir)
    tokenizer.save_pretrained(args.output_dir)
    print(f"Saved PEFT adapter to {args.output_dir}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="QLoRA fine-tuning for CleanSQL (Chat Format)")
    parser.add_argument("--train-file", required=True, help="Training JSONL file (chat format)")
    parser.add_argument("--val-file", help="Validation JSONL file (optional)")
    parser.add_argument("--output-dir", required=True, help="Output directory for LoRA adapter")
    parser.add_argument("--base-model", default="Qwen/Qwen2.5-Coder-7B-Instruct", help="Base model name")
    parser.add_argument("--lora-r", type=int, default=8, help="LoRA rank")
    parser.add_argument("--lora-alpha", type=int, default=16, help="LoRA alpha")
    parser.add_argument("--lora-dropout", type=float, default=0.05, help="LoRA dropout")
    parser.add_argument("--learning-rate", type=float, default=5e-5, help="Learning rate")
    parser.add_argument("--num-train-epochs", type=int, default=3, help="Number of training epochs")
    parser.add_argument("--per-device-train-batch-size", type=int, default=1, help="Batch size per device")
    parser.add_argument("--gradient-accumulation-steps", type=int, default=64, help="Gradient accumulation steps")
    parser.add_argument("--max-length", type=int, default=2048, help="Max sequence length")
    main(parser.parse_args())
