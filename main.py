from __future__ import annotations

import json
import os
import re
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import torch

from models.architecture import HelixNextV2


ROOT = Path(__file__).resolve().parent
STATIC_DIR = ROOT / "static"
CHECKPOINT_PATH = ROOT / "models" / "helixnext_v2_best.pt"
HOST = "127.0.0.1"
PORT = int(os.environ.get("HELIXNEXT_PORT", "8000"))
LOW_CONFIDENCE_THRESHOLD = 0.40
WARMUP_WINDOW = 32
ALLOWED_BASES = set("ACGT")


def load_model() -> tuple[HelixNextV2, dict[str, int]]:
    checkpoint = torch.load(
        CHECKPOINT_PATH,
        map_location="cpu",
        weights_only=True,
    )
    model = HelixNextV2(**checkpoint["config"])
    model.load_state_dict(checkpoint["model_state"], strict=True)
    model.eval()
    return model, checkpoint["token_to_id"]


MODEL, TOKEN_TO_ID = load_model()
ID_TO_TOKEN = {token_id: base for base, token_id in TOKEN_TO_ID.items()}


def normalize_sequence(raw: str) -> str:
    """Normalize pasted DNA or FASTA text without changing the bases."""
    without_headers = re.sub(r"^>[^\r\n]*[\r\n]?", "", raw, flags=re.MULTILINE)
    sequence = re.sub(r"\s+", "", without_headers).upper()
    if not sequence:
        raise ValueError("The sequence is empty.")

    invalid = sorted(set(sequence) - ALLOWED_BASES)
    if invalid:
        raise ValueError(
            "Only A, C, G, and T are supported. "
            f"Invalid character(s): {', '.join(invalid)}"
        )
    return sequence


def probability_map(probabilities: torch.Tensor) -> dict[str, float]:
    return {
        base: round(float(probabilities[token_id]), 6)
        for base, token_id in TOKEN_TO_ID.items()
    }


def score_sequence(sequence: str) -> dict[str, Any]:
    """Score each base against the model's causal prediction for that base."""
    token_ids = [TOKEN_TO_ID[base] for base in sequence]
    context = MODEL.context
    positions: list[dict[str, Any]] = []

    # The first base is the causal anchor: there is no prior base to score.
    # The remaining warm-up bases establish context but are not predictions.
    if sequence:
        positions.append(
            {
                "position": 1,
                "observed": sequence[0],
                "predicted": None,
                "confidence": None,
                "probabilities": None,
                "mismatch": False,
                "low_confidence": False,
                "flagged": False,
                "status": "anchor",
            }
        )

    for target_index in range(1, min(WARMUP_WINDOW, len(sequence))):
        positions.append(
            {
                "position": target_index + 1,
                "observed": sequence[target_index],
                "predicted": None,
                "confidence": None,
                "probabilities": None,
                "mismatch": False,
                "low_confidence": False,
                "flagged": False,
                "status": "warmup",
            }
        )

    # Overlapping windows keep inference bounded by the model's causal context
    # while covering every observed base after the first one.
    with torch.inference_mode():
        for window_start in range(0, max(1, len(sequence) - 1), context - 1):
            window_end = min(len(sequence), window_start + context)
            window = torch.tensor(
                [token_ids[window_start:window_end]],
                dtype=torch.long,
            )
            logits, _ = MODEL(window)
            window_probabilities = logits[0].softmax(dim=-1)

            first_target = max(WARMUP_WINDOW, window_start + 1)
            last_target = window_end - 1
            for target_index in range(first_target, last_target + 1):
                output_index = target_index - window_start - 1
                probabilities = window_probabilities[output_index]
                observed = sequence[target_index]
                predicted_id = int(probabilities.argmax().item())
                predicted = ID_TO_TOKEN[predicted_id]
                confidence = float(probabilities[TOKEN_TO_ID[observed]])
                mismatch = predicted != observed
                low_confidence = confidence < LOW_CONFIDENCE_THRESHOLD
                flagged = mismatch or low_confidence

                if mismatch and low_confidence:
                    status = "mismatch-low"
                elif mismatch:
                    status = "mismatch"
                elif low_confidence:
                    status = "low-confidence"
                else:
                    status = "clear"

                positions.append(
                    {
                        "position": target_index + 1,
                        "observed": observed,
                        "predicted": predicted,
                        "confidence": round(confidence, 6),
                        "probabilities": probability_map(probabilities),
                        "mismatch": mismatch,
                        "low_confidence": low_confidence,
                        "flagged": flagged,
                        "status": status,
                    }
                )

    flagged = [item for item in positions if item["flagged"]]
    mismatches = [item for item in positions if item["mismatch"]]
    low_confidence = [item for item in positions if item["low_confidence"]]
    scored = [item for item in positions if item["confidence"] is not None]
    weakest = min(scored, key=lambda item: item["confidence"]) if scored else None

    return {
        "sequence": sequence,
        "length": len(sequence),
        "context": context,
        "warmup_window": WARMUP_WINDOW,
        "threshold": LOW_CONFIDENCE_THRESHOLD,
        "flagged_count": len(flagged),
        "mismatch_count": len(mismatches),
        "low_confidence_count": len(low_confidence),
        "weakest": weakest,
        "positions": positions,
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "HelixNext/0.1"

    def log_message(self, format: str, *args: object) -> None:
        print(f"{self.address_string()} - {format % args}")

    def send_bytes(self, payload: bytes, content_type: str, status: int = 200) -> None:
        self.send_response(status)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(payload)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(payload)

    def send_json(self, payload: dict[str, Any], status: int = 200) -> None:
        self.send_bytes(
            json.dumps(payload).encode("utf-8"),
            "application/json; charset=utf-8",
            status,
        )

    def do_GET(self) -> None:
        path = urlparse(self.path).path
        if path in ("/", "/index.html"):
            self.send_bytes(
                (STATIC_DIR / "index.html").read_bytes(),
                "text/html; charset=utf-8",
            )
            return

        if path == "/app.js":
            self.send_bytes(
                (STATIC_DIR / "app.js").read_bytes(),
                "text/javascript; charset=utf-8",
            )
            return

        if path == "/styles.css":
            self.send_bytes(
                (STATIC_DIR / "styles.css").read_bytes(),
                "text/css; charset=utf-8",
            )
            return

        self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        if urlparse(self.path).path != "/api/hunt":
            self.send_json({"error": "Not found"}, HTTPStatus.NOT_FOUND)
            return

        try:
            length = int(self.headers.get("Content-Length", "0"))
            payload = json.loads(self.rfile.read(length) or b"{}")
            sequence = normalize_sequence(str(payload.get("sequence", "")))
            result = score_sequence(sequence)
            self.send_json(result)
        except ValueError as error:
            self.send_json({"error": str(error)}, HTTPStatus.BAD_REQUEST)
        except Exception as error:  # Keep the browser response useful on inference errors.
            print(f"Inference error: {error}")
            self.send_json(
                {"error": "The sequence could not be analyzed."},
                HTTPStatus.INTERNAL_SERVER_ERROR,
            )


def main() -> None:
    server = ThreadingHTTPServer((HOST, PORT), Handler)
    print(f"HelixNext ready at http://{HOST}:{PORT}")
    print(f"Loaded checkpoint: {CHECKPOINT_PATH.name}")
    print("Press Ctrl+C to stop the server.")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\nStopping HelixNext.")
    finally:
        server.server_close()


if __name__ == "__main__":
    main()
