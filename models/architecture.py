import torch
import torch.nn as nn
import torch.nn.functional as F


class CausalConvBlock(nn.Module):
    def __init__(self, dim, kernel_size=7, dropout=0.1):
        super().__init__()
        self.left_padding = kernel_size - 1
        self.norm = nn.LayerNorm(dim)

        self.conv = nn.Conv1d(
            dim,
            dim,
            kernel_size=kernel_size,
            groups=dim,
        )
        self.mix = nn.Linear(dim, dim)
        self.dropout = nn.Dropout(dropout)

    def forward(self, x):
        hidden = self.norm(x).transpose(1, 2)

        # Left padding prevents access to future bases.
        hidden = F.pad(hidden, (self.left_padding, 0))
        hidden = self.conv(hidden).transpose(1, 2)
        hidden = self.mix(F.gelu(hidden))

        return x + self.dropout(hidden)


class HelixNextV2(nn.Module):
    def __init__(
        self,
        context=256,
        dim=128,
        heads=4,
        layers=4,
        kernel_size=7,
        dropout=0.1,
    ):
        super().__init__()
        self.context = context

        self.token_embedding = nn.Embedding(4, dim)
        self.position_embedding = nn.Embedding(context, dim)

        self.convs = nn.ModuleList([
            CausalConvBlock(dim, kernel_size, dropout)
            for _ in range(layers)
        ])

        self.blocks = nn.ModuleList([
            nn.TransformerEncoderLayer(
                d_model=dim,
                nhead=heads,
                dim_feedforward=4 * dim,
                dropout=dropout,
                activation="gelu",
                batch_first=True,
                norm_first=True,
            )
            for _ in range(layers)
        ])

        self.norm = nn.LayerNorm(dim)
        self.output = nn.Linear(dim, 4)

        self.register_buffer(
            "causal_mask",
            torch.triu(
                torch.ones(context, context, dtype=torch.bool),
                diagonal=1,
            ),
        )

    def forward(self, tokens, targets=None):
        length = tokens.shape[1]

        if not 1 <= length <= self.context:
            raise ValueError(
                f"Input length must be between 1 and {self.context}"
            )

        positions = torch.arange(length, device=tokens.device)

        hidden = (
            self.token_embedding(tokens)
            + self.position_embedding(positions)
        )

        mask = self.causal_mask[:length, :length]

        for conv, block in zip(self.convs, self.blocks):
            hidden = conv(hidden)
            hidden = block(hidden, src_mask=mask)

        logits = self.output(self.norm(hidden))

        loss = None
        if targets is not None:
            loss = F.cross_entropy(
                logits.reshape(-1, 4),
                targets.reshape(-1),
            )

        return logits, loss