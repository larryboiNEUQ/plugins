#!/usr/bin/env python3
"""Hillclimb / regression harness for the fast-io-lite plugin."""

import argparse
import concurrent.futures
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
CASES_FILE = HERE / "cases.json"
RESULTS_DIR = HERE / "results"


def resolve_agy() -> str:
    env_bin = os.environ.get("AGY_BIN")
    if env_bin:
        return env_bin
    found = shutil.which("agy")
    if found:
        return found
    return os.path.expanduser("~/.local/bin/agy")


def resolve_brain_dir() -> str:
    return os.environ.get(
        "AGY_BRAIN_DIR", os.path.expanduser("~/.gemini/antigravity-cli/brain")
    )


def make_repo() -> str:
    d = tempfile.mkdtemp(prefix="eval-fast-io-lite-")
    subprocess.run(["git", "init", "-q"], cwd=d, check=True)
    subprocess.run(["git", "config", "user.email", "eval@example.com"], cwd=d, check=True)
    subprocess.run(["git", "config", "user.name", "Eval"], cwd=d, check=True)
    (Path(d) / "pricing.js").write_text(
        "export function calculatePrice(price, discount = 0) {\n"
        "  return Math.max(0, price * (1 - discount));\n"
        "}\n"
    )
    (Path(d) / "cart.js").write_text(
        "import { calculatePrice } from './pricing.js';\n"
        "export function cartTotal(items) {\n"
        "  return items.reduce((sum, it) => sum + calculatePrice(it.price, it.discount), 0);\n"
        "}\n"
    )
    (Path(d) / "invoice.js").write_text(
        "import { calculatePrice } from './pricing.js';\n"
        "export function renderLine(name, price, discount) {\n"
        "  return `${name}: ${calculatePrice(price, discount).toFixed(2)}`;\n"
        "}\n"
    )
    subprocess.run(["git", "add", "."], cwd=d, check=True)
    subprocess.run(["git", "commit", "-qm", "init"], cwd=d, check=True)
    return d


def inspect_transcript(brain_dir: str, cid: str) -> dict:
    tp = Path(brain_dir) / cid / ".system_generated/logs/transcript.jsonl"
    info = {
        "writes": [],
        "pstack_reads": [],
        "agy_reads": 0,
        "read_poteto_help": False,
        "read_poteto_mode": False,
        "ro_skills_read": [],
        "first_write_step": None,
        "first_poteto_step": None,
        "tool_steps": 0,
    }
    if not tp.exists():
        return info
    with tp.open() as f:
        for line in f:
            try:
                o = json.loads(line)
            except Exception:
                continue
            si = o.get("step_index")
            tcs = o.get("tool_calls") or []
            if tcs:
                info["tool_steps"] += 1
            for tc in tcs:
                nm = tc.get("name")
                args = tc.get("args") or {}
                path = str(args.get("Path", "")).strip('"')
                if nm in ("edit_file", "write_file"):
                    info["writes"].append((si, nm, path))
                    if info["first_write_step"] is None:
                        info["first_write_step"] = si
                if nm == "read_file" and "pstack" in path:
                    info["pstack_reads"].append((si, path))
                    if path.endswith("docs/harness/agy.md"):
                        info["agy_reads"] += 1
                    if path.endswith("skills/poteto-help/SKILL.md"):
                        info["read_poteto_help"] = True
                    if path.endswith("skills/poteto-mode/SKILL.md"):
                        info["read_poteto_mode"] = True
                        if info["first_poteto_step"] is None:
                            info["first_poteto_step"] = si
                    m = re.search(r"pstack/skills/([^/]+)/SKILL\.md$", path)
                    if m and m.group(1) not in ("poteto-help", "poteto-mode"):
                        info["ro_skills_read"].append(m.group(1))
    return info


def check_case(case: dict, repo: str, resp_text: str, tr: dict, mode: str) -> dict:
    git_dirty = bool(
        subprocess.check_output(["git", "status", "--porcelain"], cwd=repo, text=True).strip()
    )
    lines = [ln.strip() for ln in resp_text.strip().splitlines() if ln.strip()]
    last_line = lines[-1] if lines else ""
    tail = "\n".join(resp_text.strip().splitlines()[-15:])
    kind = case["kind"]

    if kind == "simple_ro":
        c_gate = (len(tr["writes"]) == 0) and (not git_dirty)
        c_route = (
            not tr["read_poteto_help"]
            and not tr["read_poteto_mode"]
            and len(tr["ro_skills_read"]) == 0
        )
        c_rcpt = last_line == "[轮次: 只查 | pstack: 未启用]"
    elif kind == "heavy_ro":
        c_gate = (len(tr["writes"]) == 0) and (not git_dirty)
        c_route = tr["read_poteto_help"] and (len(tr["ro_skills_read"]) > 0)
        if mode == "compact":
            m = re.match(r"^\[轮次:\s*只查\s*\|\s*pstack:\s*(.+?)\]$", last_line)
            c_rcpt = bool(m and m.group(1).strip() not in ("未启用", "无", ""))
        else:
            c_rcpt = (
                "---" in tail
                and "**[轮次: 只查]**" in tail
                and "**过程**" in tail
                and "**验证**" not in tail
                and not last_line.startswith("```")
            )
    else:  # edit
        c_gate = git_dirty
        c_route = tr["read_poteto_mode"] and (
            tr["first_write_step"] is None
            or (
                tr["first_poteto_step"] is not None
                and tr["first_poteto_step"] < tr["first_write_step"]
            )
        )
        if mode == "compact":
            m = re.match(r"^\[轮次:\s*动手\s*\|\s*pstack:\s*(.+?)\]$", last_line)
            c_rcpt = bool(
                m
                and m.group(1).strip() not in ("未启用", "未执行", "未完成", "无", "")
                and "**[轮次: 动手]**" not in tail
            )
        else:
            c_rcpt = (
                "---" in tail
                and "**[轮次: 动手]**" in tail
                and "**过程**" in tail
                and "**验证**" in tail
                and not last_line.startswith("```")
            )

    return {
        "gate": c_gate,
        "route": c_route,
        "receipt": c_rcpt,
        "score": int(c_gate) + int(c_route) + int(c_rcpt),
        "last_line": last_line[:140],
        "ro_skills": tr["ro_skills_read"],
        "read_poteto_help": tr["read_poteto_help"],
        "read_poteto_mode": tr["read_poteto_mode"],
        "writes": len(tr["writes"]),
        "tool_steps": tr["tool_steps"],
    }


def run_single(case: dict, agy: str, brain_dir: str, model: str, mode: str, env: dict) -> dict:
    repo = make_repo()
    t0 = time.time()
    try:
        proc = subprocess.run(
            [
                agy,
                "--model",
                model,
                "-p",
                case["prompt"],
                "--dangerously-skip-permissions",
                "--output-format",
                "json",
            ],
            cwd=repo,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
        )
        dt = round(time.time() - t0, 1)
        if proc.returncode != 0:
            return {
                "id": case["id"],
                "error": proc.stderr[:240],
                "score": 0,
                "tokens": 0,
                "sec": dt,
            }
        data = json.loads(proc.stdout)
        cid = data.get("conversation_id", "")
        resp = data.get("response", "")
        tok = (data.get("usage") or {}).get("total_tokens", 0)
        tr = inspect_transcript(brain_dir, cid)
        chk = check_case(case, repo, resp, tr, mode)
        chk.update({"id": case["id"], "cid": cid[:8], "tokens": tok, "sec": dt})
        return chk
    finally:
        shutil.rmtree(repo, ignore_errors=True)


def run_multiturn(case: dict, agy: str, brain_dir: str, model: str, env: dict) -> dict:
    repo = make_repo()
    try:
        t0 = time.time()
        p1 = subprocess.run(
            [
                agy,
                "--model",
                model,
                "-p",
                case["turn1_prompt"],
                "--dangerously-skip-permissions",
                "--output-format",
                "json",
            ],
            cwd=repo,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
        )
        dt1 = round(time.time() - t0, 1)
        if p1.returncode != 0:
            return {"id": case["id"], "error": p1.stderr[:240], "passed": False}
        d1 = json.loads(p1.stdout)
        cid = d1["conversation_id"]
        tr1 = inspect_transcript(brain_dir, cid)

        t1 = time.time()
        p2 = subprocess.run(
            [
                agy,
                "--model",
                model,
                "--resume",
                cid,
                "-p",
                case["turn2_prompt"],
                "--dangerously-skip-permissions",
                "--output-format",
                "json",
            ],
            cwd=repo,
            env=env,
            capture_output=True,
            text=True,
            timeout=300,
        )
        dt2 = round(time.time() - t1, 1)
        if p2.returncode != 0:
            return {"id": case["id"], "error": p2.stderr[:240], "passed": False}
        d2 = json.loads(p2.stdout)
        tr2 = inspect_transcript(brain_dir, cid)
        git_dirty = bool(
            subprocess.check_output(["git", "status", "--porcelain"], cwd=repo, text=True).strip()
        )
        agy_new = tr2["agy_reads"] - tr1["agy_reads"]
        l1 = [ln.strip() for ln in d1["response"].strip().splitlines() if ln.strip()][-1]
        l2 = [ln.strip() for ln in d2["response"].strip().splitlines() if ln.strip()][-1]
        passed = (
            len(tr1["ro_skills_read"]) > 0
            and tr2["read_poteto_mode"]
            and git_dirty
            and agy_new == 0
        )
        return {
            "id": case["id"],
            "cid": cid[:8],
            "passed": passed,
            "turn1": {
                "sec": dt1,
                "tokens": (d1.get("usage") or {}).get("total_tokens", 0),
                "agy_reads": tr1["agy_reads"],
                "ro_skills": tr1["ro_skills_read"],
                "last_line": l1[:140],
            },
            "turn2": {
                "sec": dt2,
                "tokens": (d2.get("usage") or {}).get("total_tokens", 0),
                "agy_reads_new": agy_new,
                "read_poteto_mode": tr2["read_poteto_mode"],
                "git_dirty": git_dirty,
                "last_line": l2[:140],
            },
        }
    finally:
        shutil.rmtree(repo, ignore_errors=True)


def main() -> int:
    ap = argparse.ArgumentParser(description="Run fast-io-lite hillclimb/regression eval.")
    ap.add_argument("--label", default="run", help="Output label saved under results/<label>.json")
    ap.add_argument("--mode", choices=("compact", "detailed"), default="compact")
    ap.add_argument("--model", default=os.environ.get("HC_MODEL", "gemini-4-hydrogen-medium"))
    ap.add_argument("--cases", default="", help="Comma-separated single-turn case IDs (default: all)")
    ap.add_argument("--include-multiturn", action="store_true", help="Also run 2-turn resume reuse check")
    ap.add_argument("--workers", type=int, default=3)
    ap.add_argument("--dry-run", action="store_true", help="Validate config/cases and exit")
    args = ap.parse_args()

    cfg = json.loads(CASES_FILE.read_text())
    single_cases = cfg["single_turn"]
    if args.cases:
        want = {c.strip() for c in args.cases.split(",") if c.strip()}
        single_cases = [c for c in single_cases if c["id"] in want]
        missing = want - {c["id"] for c in single_cases}
        if missing:
            print(f"Unknown case IDs: {sorted(missing)}", file=sys.stderr)
            return 2

    agy = resolve_agy()
    brain_dir = resolve_brain_dir()
    if args.dry_run:
        print(
            json.dumps(
                {
                    "dry_run": True,
                    "agy": agy,
                    "agy_exists": os.path.exists(agy),
                    "brain_dir": brain_dir,
                    "mode": args.mode,
                    "model": args.model,
                    "single_turn_cases": [c["id"] for c in single_cases],
                    "multi_turn_cases": [c["id"] for c in cfg["multi_turn"]]
                    if args.include_multiturn
                    else [],
                },
                ensure_ascii=False,
                indent=2,
            )
        )
        return 0 if os.path.exists(agy) else 1

    env = os.environ.copy()
    env["PATH"] = f"/opt/homebrew/bin:{os.path.expanduser('~/.local/bin')}:{env.get('PATH', '')}"

    t_all = time.time()
    with concurrent.futures.ThreadPoolExecutor(max_workers=max(1, args.workers)) as ex:
        results = list(
            ex.map(lambda c: run_single(c, agy, brain_dir, args.model, args.mode, env), single_cases)
        )
    mt_results = []
    if args.include_multiturn:
        for mc in cfg["multi_turn"]:
            mt_results.append(run_multiturn(mc, agy, brain_dir, args.model, env))
    wall = round(time.time() - t_all, 1)

    summary = {
        "label": args.label,
        "model": args.model,
        "receipt_mode": args.mode,
        "score": sum(r.get("score", 0) for r in results),
        "max_score": len(single_cases) * 3,
        "total_tokens": sum(r.get("tokens", 0) for r in results),
        "sum_sec": round(sum(r.get("sec", 0.0) for r in results), 1),
        "wall_sec": wall,
        "cases": results,
        "multi_turn": mt_results,
    }
    RESULTS_DIR.mkdir(parents=True, exist_ok=True)
    out_path = RESULTS_DIR / f"{args.label}.json"
    out_path.write_text(json.dumps(summary, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps(summary, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
