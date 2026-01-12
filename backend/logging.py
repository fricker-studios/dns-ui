import inspect
import logging
import pathlib
import sys
import traceback
from logging import Logger
from typing import Literal

RELEVANT_ROOT_DIR = "".join(pathlib.Path(__file__).parts[:2])

# Configure root logger with stdout handler
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(filename)s:%(lineno)d - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout)
    ]
)

old_factory = logging.getLogRecordFactory()


def record_factory(*args, **kwargs):
    record = old_factory(*args, **kwargs)
    try:
        actual_calling_frame = next(  # pragma: nocover
            frameinfo
            for frameinfo in inspect.stack()
            if frameinfo.filename.startswith(RELEVANT_ROOT_DIR)
            and frameinfo.filename != __file__
        )
    except StopIteration:  # pragma: nocover
        pass
    else:
        record.pathname = actual_calling_frame.filename
        record.lineno = actual_calling_frame.lineno
        record.funcName = actual_calling_frame.function
        record.filename = pathlib.Path(actual_calling_frame.filename).parts[-1]
        record.module = record.name.split(".")[-1]
    return record


logging.setLogRecordFactory(record_factory)


class BaseLogger:
    def __init__(self, logger: Logger, level = logging.INFO):
        self.logger = logger
        self.logger.setLevel(level)

    def _log_message(self, func, msg, *args, **kwargs):  # pragma: nocover
        return func(msg, *args, **kwargs)

    def debug(self, msg, *args, **kwargs):
        return self.logger.debug(msg, *args, **kwargs)

    def info(self, msg, *args, **kwargs):
        return self.logger.info(msg, *args, **kwargs)

    def warning(self, msg, *args, **kwargs):
        return self.logger.warning(msg, *args, **kwargs)

    def error(self, msg, *args, **kwargs):
        return self.logger.error(msg, *args, **kwargs)

    def critical(self, msg, *args, **kwargs):
        return self.logger.critical(msg, *args, **kwargs)

    def exception(self, msg, *args, **kwargs):
        return self.logger.exception(msg, *args, **kwargs)


def _filepath_to_dotpath(filepath):  # pragma: nocover
    project_root = RELEVANT_ROOT_DIR + "/"
    anchor = filepath.rindex(project_root)
    path = pathlib.Path(filepath[anchor:])
    parts = path.with_suffix("").parts
    if parts[-1] == "__init__":
        parts = parts[:-1]
    name = ".".join(parts)
    return name.replace("/.", "")


def getLogger(name=None, level=logging.INFO):  # pragma: nocover
    if name is None:
        frames = traceback.extract_stack()
        for i, frame in enumerate(frames):  # pragma: nocover
            if frame.filename == __file__:
                break
        filepath = frames[i - 1].filename
        name = _filepath_to_dotpath(filepath)

    logger = BaseLogger(logging.getLogger(name), level)
    return logger
