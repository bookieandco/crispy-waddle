from __future__ import annotations

import gc
import json
import os
from pathlib import Path
from typing import Any

_MODEL: Any = None
_PROCESSOR: Any = None


def _model_path() -> str:
    return os.getenv(
        "DIRECTOR_WATCH_QWEN_MODEL_PATH",
        "/workspace/jhadina/models/HunyuanVideo-1.5/text_encoder/llm",
    ).strip()


def _load() -> tuple[Any, Any]:
    global _MODEL, _PROCESSOR
    if _MODEL is not None and _PROCESSOR is not None:
        return _MODEL, _PROCESSOR

    model_path = _model_path()
    if not Path(model_path).exists():
        raise RuntimeError("DIRECTOR_WATCH_LOCAL_QWEN_MODEL_MISSING")

    import torch
    from transformers import AutoProcessor
    try:
        from transformers import Qwen2_5_VLForConditionalGeneration as ModelClass
    except ImportError:
        try:
            from transformers import AutoModelForImageTextToText as ModelClass
        except ImportError:
            from transformers import AutoModelForVision2Seq as ModelClass

    if not torch.cuda.is_available():
        raise RuntimeError("DIRECTOR_WATCH_LOCAL_QWEN_CUDA_REQUIRED")

    _PROCESSOR = AutoProcessor.from_pretrained(
        model_path,
        local_files_only=True,
        trust_remote_code=False,
    )
    _MODEL = ModelClass.from_pretrained(
        model_path,
        torch_dtype="auto",
        device_map="auto",
        local_files_only=True,
        trust_remote_code=False,
    )
    _MODEL.eval()
    return _MODEL, _PROCESSOR


def _parse_json(text: str) -> dict[str, Any]:
    value = text.strip()
    if value.startswith("```"):
        lines = value.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip() == "```":
            lines = lines[:-1]
        value = "\n".join(lines)
        if value.lstrip().startswith("json"):
            value = value.lstrip()[4:].lstrip()
    parsed = json.loads(value)
    if not isinstance(parsed, dict):
        raise RuntimeError("DIRECTOR_WATCH_VLM_JSON_INVALID")
    return parsed


def request_json(image_paths: list[Path], prompt: str) -> dict[str, Any]:
    if not image_paths:
        raise RuntimeError("DIRECTOR_WATCH_VLM_IMAGE_REQUIRED")

    from PIL import Image

    model, processor = _load()
    images = []
    try:
        for path in image_paths:
            with Image.open(path) as image:
                images.append(image.convert("RGB").copy())

        content = [{"type": "image"} for _ in images]
        content.append({"type": "text", "text": prompt})
        messages = [{"role": "user", "content": content}]
        rendered = processor.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )
        inputs = processor(
            text=[rendered],
            images=images,
            padding=True,
            return_tensors="pt",
        )
        device = next(model.parameters()).device
        inputs = {key: value.to(device) if hasattr(value, "to") else value for key, value in inputs.items()}
        generated = model.generate(
            **inputs,
            max_new_tokens=int(os.getenv("DIRECTOR_WATCH_MAX_NEW_TOKENS", "1200")),
            do_sample=False,
        )
        input_length = inputs["input_ids"].shape[1]
        output = generated[:, input_length:]
        text = processor.batch_decode(
            output,
            skip_special_tokens=True,
            clean_up_tokenization_spaces=False,
        )[0]
        return _parse_json(text)
    finally:
        for image in images:
            try:
                image.close()
            except Exception:
                pass


def release_local_qwen() -> None:
    global _MODEL, _PROCESSOR
    _MODEL = None
    _PROCESSOR = None
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
            torch.cuda.ipc_collect()
    except Exception:
        pass
