import os

import uvicorn


def main():
    host = os.getenv("PYWORKER_HOST", "0.0.0.0")
    port = int(os.getenv("PYWORKER_PORT", "8000"))
    uvicorn.run("pyworker.app:app", host=host, port=port, reload=True)


if __name__ == "__main__":
    main()
