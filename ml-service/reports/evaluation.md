# Walk-forward evaluation

Chronological evaluation only; each forecast sees at most the preceding 200 candles and is scored against the next 1 bar (horizons 5/30) or 2 bars (horizon 10). No rows are shuffled and no model is trained on this data.

Model: `NeoQuasar/Kronos-small`; sample paths: 10; sideways threshold: 0.05%; evaluation seed: 20261031.
The confidence intervals below are 95% Wilson intervals for accuracy. Samples under 30 are explicitly too small to support a conclusion; even larger intraday Yahoo samples remain a rough diagnostic, not evidence of trading profitability.
The majority-class baseline is selected from actual evaluation labels as a hindsight frequency reference, not a deployable strategy.
Skipped points failed service candle validation; source gaps are excluded rather than filled or interpolated.

| Horizon | Source | N | Accuracy (95% CI) | Always sideways | Always UP | Majority baseline | Lift vs best baseline | High-confidence accuracy (N) | Skipped |
|---:|---|---:|---|---:|---:|---:|---:|---|---:|
| 5 | nsei_5m.csv | 28 | 0.857 [0.685, 0.943] | 0.857 | 0.036 | SIDEWAYS 0.857 | +0.000 | 0.952 (21) | 2 |

Horizon 5: only 28 scored points; the sample is too small to conclude whether the model differs meaningfully from a baseline.

### Horizon 5

Per-class precision / recall / support:

| Class | Precision | Recall | Support |
|---|---:|---:|---:|
| UP | 0.250 | 1.000 | 1 |
| DOWN | 0.000 | 0.000 | 3 |
| SIDEWAYS | 0.958 | 0.958 | 24 |

Confusion matrix (actual rows, predicted columns):

| Actual \ Predicted | UP | DOWN | SIDEWAYS |
|---|---:|---:|---:|
| UP | 1 | 0 | 0 |
| DOWN | 2 | 0 | 1 |
| SIDEWAYS | 1 | 0 | 23 |

| 10 | nsei_5m.csv | 27 | 0.630 [0.442, 0.785] | 0.630 | 0.259 | SIDEWAYS 0.630 | +0.000 | 0.650 (20) | 3 |

Horizon 10: only 27 scored points; the sample is too small to conclude whether the model differs meaningfully from a baseline.

### Horizon 10

Per-class precision / recall / support:

| Class | Precision | Recall | Support |
|---|---:|---:|---:|
| UP | 0.667 | 0.286 | 7 |
| DOWN | 0.250 | 0.333 | 3 |
| SIDEWAYS | 0.700 | 0.824 | 17 |

Confusion matrix (actual rows, predicted columns):

| Actual \ Predicted | UP | DOWN | SIDEWAYS |
|---|---:|---:|---:|
| UP | 2 | 1 | 4 |
| DOWN | 0 | 1 | 2 |
| SIDEWAYS | 1 | 2 | 14 |

| 30 | nsei_30m.csv | 30 | 0.300 [0.167, 0.479] | 0.200 | 0.367 | DOWN 0.433 | -0.133 | 0.118 (17) | 0 |

Horizon 30: only 30 scored points; the sample is too small to conclude whether the model differs meaningfully from a baseline.

### Horizon 30

Per-class precision / recall / support:

| Class | Precision | Recall | Support |
|---|---:|---:|---:|
| UP | 0.286 | 0.182 | 11 |
| DOWN | 0.400 | 0.308 | 13 |
| SIDEWAYS | 0.231 | 0.500 | 6 |

Confusion matrix (actual rows, predicted columns):

| Actual \ Predicted | UP | DOWN | SIDEWAYS |
|---|---:|---:|---:|
| UP | 2 | 4 | 5 |
| DOWN | 4 | 4 | 5 |
| SIDEWAYS | 1 | 2 | 3 |

For this run, each horizon's 95% accuracy interval includes its best baseline; these results do not support a claim that the model beats a baseline.

### Data and limitations

Input CSVs are generic `t,o,h,l,c,v` candles. Yahoo Finance `^NSEI` intraday history is generally limited to about 60 days for 5-minute bars. NSEI index data is not the same as tradable Nifty 50 constituent prices, and this evaluation does not account for charges, slippage, liquidity, or overlapping forecast dependence.

Future information leakage check: `tests/test_walk_forward.py::test_prediction_input_at_t_is_invariant_to_future_rows` verifies that evaluation history and the deterministic mock prediction at time t do not change when later rows are appended.
