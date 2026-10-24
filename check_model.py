from pathlib import Path
import torch
from models.architecture import HelixNextV2

checkpoint_path = (
    Path(__file__).resolve().parent
    / "models"
    / "helixnext_v2_best.pt"
)

checkpoint = torch.load(
    checkpoint_path,
    map_location="cpu",
    weights_only=True,
)

model = HelixNextV2(**checkpoint["config"])
model.load_state_dict(checkpoint["model_state"], strict=True)
model.eval()

sequence = "ACGTACGTACGT"
token_to_id = checkpoint["token_to_id"]

x = torch.tensor(
    [[token_to_id[base] for base in sequence]],
    dtype=torch.long,
)

with torch.inference_mode():
    logits, _ = model(x)
    probabilities = logits[0, -1].softmax(dim=-1)

print(f"Loaded checkpoint from epoch {checkpoint['epoch']}")
print(f"Input: {sequence}")
print("Next-base probabilities:")

for base, token_id in token_to_id.items():
    print(f"  {base}: {probabilities[token_id].item():.2%}")