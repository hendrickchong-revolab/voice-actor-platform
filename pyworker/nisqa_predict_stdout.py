import argparse
import contextlib
import io
import os
import sys


def main() -> int:
    parser = argparse.ArgumentParser(description="Run NISQA and print CSV to stdout")
    parser.add_argument("--wav", required=True, help="Path to a .wav file")
    parser.add_argument(
        "--repo",
        default=os.getenv("NISQA_REPO_DIR", ""),
        help="Path to cloned NISQA repo (must contain nisqa/ and run_predict.py)",
    )
    parser.add_argument(
        "--model",
        default=os.getenv("NISQA_MODEL_PATH", ""),
        help="Path to pretrained model weights (e.g. .../weights/nisqa.tar)",
    )
    parser.add_argument("--bs", type=int, default=1)
    parser.add_argument("--num_workers", type=int, default=0)
    parser.add_argument("--ms_channel", type=int, default=None)
    args = parser.parse_args()

    if not args.repo:
        raise SystemExit("Missing --repo (or env NISQA_REPO_DIR)")
    if not args.model:
        raise SystemExit("Missing --model (or env NISQA_MODEL_PATH)")

    # Import NISQA from the cloned repo.
    sys.path.insert(0, args.repo)
    try:
        from nisqa.NISQA_model import nisqaModel  # type: ignore
    except Exception as e:
        raise SystemExit(f"Failed to import NISQA from repo: {e}")

    # Provide the minimal args run_predict.py would supply.
    model_args = {
        "mode": "predict_file",
        "pretrained_model": args.model,
        "deg": args.wav,
        "output_dir": "",  # don't write NISQA_results.csv
        "num_workers": args.num_workers,
        "bs": args.bs,
        "ms_channel": args.ms_channel,
    }

    # NISQA prints progress / tables to stdout; suppress it so our caller gets clean CSV.
    with contextlib.redirect_stdout(io.StringIO()), contextlib.redirect_stderr(io.StringIO()):
        nisqa = nisqaModel(model_args)
        df = nisqa.predict()

    # Print the actual CSV that our pyworker parser expects.
    # Columns include: deg, mos_pred, noi_pred, dis_pred, col_pred, loud_pred, model
    sys.stdout.write(df.to_csv(index=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
