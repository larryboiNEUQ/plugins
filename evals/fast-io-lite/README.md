# fast-io-lite 评测与 Hillclimb 套件

用于回归验证和持续优化 `fast-io-lite/rules/AGENTS.md`（不随插件安装，位于仓库根目录 `evals/fast-io-lite/`）。

## 用法

```bash
# 校验配置与用例（不发模型请求）
python3 evals/fast-io-lite/run_eval.py --dry-run

# 跑简洁版全量 6 题（默认模型 gemini-4-hydrogen-medium）
python3 evals/fast-io-lite/run_eval.py --mode compact --label compact_run

# 跑详细版全量 6 题 + 两轮上下文复用检查
python3 evals/fast-io-lite/run_eval.py --mode detailed --include-multiturn --label detailed_run

# 只跑单个或几个 badcase
python3 evals/fast-io-lite/run_eval.py --mode compact --cases simple_ro,medium_ro_neg --label quick
```

## 新增 badcase

直接向 `evals/fast-io-lite/cases.json` 的 `single_turn` 追加条目：
- `kind: "simple_ro"`：普通只查/负样本（要求零写入、不触发 `pstack`、回执 `未启用`）
- `kind: "heavy_ro"`：重只查（要求零写入、读 `poteto-help` 并命中只读 skill）
- `kind: "edit"`：明确动手（要求先读 `poteto-mode` 再改、仓库有改动、回执符合当前 `--mode`）

## 本地产物（已 gitignore）

- `evals/fast-io-lite/results/*.json`：每次实跑输出
- `evals/fast-io-lite/decision.tsv`：本地 hillclimb 实验记录
