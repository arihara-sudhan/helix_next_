
# HelixNext

HelixNext is a small local UI for inspecting causal next-base predictions from the saved `HelixNextV2` checkpoint.

## Run

```powershell
uv run .\main.py
```

Open <http://127.0.0.1:8000>.

The interface includes five checkpoint-tested synthetic experiments and a Hunt view. The first 32 bases establish context; Hunt scores only later bases from the preceding causal window. A position is a candidate when the model's top next base differs from the observed base or when the observed base has probability below 40%. These are model signals, not confirmed biological edits.
