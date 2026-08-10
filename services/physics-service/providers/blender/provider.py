from .runner import run_simulation

class BlenderPhysicsProvider:
    name = "blender"

    def health(self) -> dict:
        return {"provider": self.name, "status": "ready"}

    def simulate(self, request: dict) -> dict:
        return run_simulation(request)

    def fetch_artifact(self, artifact_path: str) -> bytes:
        with open(artifact_path, "rb") as f:
            return f.read()
