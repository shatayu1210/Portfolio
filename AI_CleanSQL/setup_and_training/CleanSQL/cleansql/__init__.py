"""CleanSQL package exports."""

from importlib.metadata import version, PackageNotFoundError

try:
    __version__ = version("cleansql")
except PackageNotFoundError:  # pragma: no cover
    __version__ = "0.0.0"

__all__ = ["__version__"]
