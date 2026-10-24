# HelixNext

[![DNA strand](https://savageandgray.co.uk/wp-content/uploads/2017/04/DNA-Strand.gif)](https://images.pexels.com/photos/35967917/pexels-photo-35967917/free-photo-of-abstract-visual-representation-of-dna-helix.png?cs=tinysrgb&dpr=1&w=500)

**HelixNext** is a local research interface for exploring causal next-base predictions from a saved `HelixNextV2` model. It presents synthetic DNA sequences exactly, visualizes the selected sequence as a colored helix, and highlights candidate base-level mismatches discovered during a Hunt.

> HelixNext is an experimental model-inspection tool. Its signals are not confirmed mutations, medical guidance, or a substitute for biological validation.

## What it does

- Loads the bundled `HelixNextV2` checkpoint on CPU.
- Provides five checkpoint-tested synthetic sequences:
  - ACGT control
  - ACGT edit hunt
  - AT guide control
  - AT guide edits
  - ATG motif edits
- Keeps the exact observed sequence visible in the sequence panel.
- Uses a 32-base warm-up window to establish causal context.
- Begins scoring at base 33, avoiding cold-start predictions.
- Marks model-detected mismatches on the DNA visualizer with red glowing base pairs.
- Reports observed-base probabilities and low-confidence positions.

## Run locally

Install dependencies with [uv](https://docs.astral.sh/uv/), then start the app:

```powershell
uv run .\main.py
```

Open [http://127.0.0.1:8000](http://127.0.0.1:8000) in a browser.

To use another local port:

```powershell
$env:HELIXNEXT_PORT = "8001"
uv run .\main.py
```

## Model behavior

The model predicts the next base from the preceding causal sequence context. The first 32 bases are retained as context only:

```text
1 A   anchor   no prior base   not scored   anchor
2–32  context  warm-up only    not scored
33+   scored   causal next-base predictions
```

A position becomes a candidate signal when either:

1. the model's top predicted base differs from the observed base; or
2. the observed base probability falls below the current 40% confidence threshold.

These are model-generated screening signals, not confirmed biological edits.

## Project layout

```text
helixnext/
├── main.py                         Local HTTP server and Hunt API
├── check_model.py                  Command-line checkpoint smoke test
├── models/
│   ├── architecture.py             HelixNextV2 definition
│   └── helixnext_v2_best.pt        Saved model checkpoint
├── static/
│   ├── index.html                  Interface structure
│   ├── app.js                      Sequence selection and Hunt rendering
│   └── styles.css                  UI and DNA visualizer styling
└── lab/
    └── prototype-causal-first-slice-dataset.ipynb
```

## Command-line checkpoint check

To verify that the checkpoint loads and produces next-base probabilities:

```powershell
uv run .\check_model.py
```

## License and attribution

The animated DNA image used in this README is hosted by [Savage & Gray](https://savageandgray.co.uk/wp-content/uploads/2017/04/DNA-Strand.gif). Check the source site's usage rights before redistributing it outside this project.
