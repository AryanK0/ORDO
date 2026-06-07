import re
from pathlib import Path


class WhisperService:
    def __init__(self, model_size: str = "tiny") -> None:
        self.model_size = model_size
        self._model = None
        self._load_error: str | None = None

    @property
    def engine_name(self) -> str:
        return f"faster-whisper:{self.model_size}"

    def available(self) -> bool:
        return self._load_model() is not None

    def transcribe(self, file_path: Path) -> str:
        candidates = self.transcribe_candidates(file_path)
        if not candidates:
            return ""
        return max(candidates, key=self._candidate_score)

    def transcribe_candidates(self, file_path: Path) -> list[str]:
        model = self._load_model()
        if model is None:
            return []
        candidates: list[str] = []
        for language in ("hi", "en"):
            try:
                segments, _ = model.transcribe(
                    str(file_path),
                    beam_size=5,
                    vad_filter=False,
                    language=language,
                )
                text = " ".join(segment.text.strip() for segment in segments if segment.text.strip()).strip()
                if text and text not in candidates:
                    candidates.append(text)
            except Exception:
                continue
        return sorted(candidates, key=self._candidate_score, reverse=True)

    def setup_message(self) -> str:
        if self._load_error:
            return self._load_error
        return "Install faster-whisper and ffmpeg to enable local audio transcription."

    def _load_model(self):
        if self._model is not None:
            return self._model
        if self._load_error:
            return None
        try:
            from faster_whisper import WhisperModel

            self._model = WhisperModel(self.model_size, device="cpu", compute_type="int8")
            return self._model
        except Exception as exc:
            self._load_error = f"Whisper is not available: {exc}"
            return None

    def _candidate_score(self, text: str) -> int:
        lowered = text.lower()
        score = len(re.findall(r"[a-zA-Z]", text))
        score += len(re.findall(r"\d", text)) * 8
        score += sum(
            20
            for token in (
                "vent",
                "calc",
                "calci",
                "calcy",
                "tab",
                "syr",
                "forte",
                "k2",
                "inj",
            )
            if token in lowered
        )
        non_latin = sum(1 for character in text if ord(character) > 127)
        score -= non_latin * 2
        return score
