import pytest
import requests


def pytest_addoption(parser):
    parser.addoption("--base-url", default="http://localhost:8000", help="API base URL")


@pytest.fixture(scope="session")
def base_url(request):
    return request.config.getoption("--base-url").rstrip("/")


class Api:
    """Thin wrapper around requests — the only test dependency besides the URL."""

    def __init__(self, base_url):
        self.base = base_url + "/api/v1"
        self.token = None

    def auth(self, email, pwd="a"):
        r = requests.post(f"{self.base}/auth/login", json={"email": email, "password": pwd})
        assert r.status_code == 200, f"Login failed for {email}: {r.text}"
        self.token = r.json()["access_token"]
        return r.json()

    def _headers(self):
        h = {"Content-Type": "application/json"}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        return h

    def get(self, path, **kw):
        return requests.get(f"{self.base}{path}", headers=self._headers(), **kw)

    def post(self, path, json=None, **kw):
        return requests.post(f"{self.base}{path}", json=json, headers=self._headers(), **kw)

    def patch(self, path, json=None, **kw):
        return requests.patch(f"{self.base}{path}", json=json, headers=self._headers(), **kw)

    def put(self, path, json=None, **kw):
        return requests.put(f"{self.base}{path}", json=json, headers=self._headers(), **kw)

    def delete(self, path, **kw):
        return requests.delete(f"{self.base}{path}", headers=self._headers(), **kw)

    def upload(self, path, file_bytes, filename="test.txt", fields=None):
        """Multipart upload — no Content-Type header (requests sets boundary)."""
        h = {}
        if self.token:
            h["Authorization"] = f"Bearer {self.token}"
        files = {"file": (filename, file_bytes)}
        return requests.post(f"{self.base}{path}", headers=h, files=files, data=fields or {})


@pytest.fixture
def api(base_url):
    """Fresh Api instance per test — no auth by default."""
    return Api(base_url)


@pytest.fixture
def admin_api(base_url):
    a = Api(base_url)
    a.auth("admin@test.com")
    return a


@pytest.fixture
def broker1_api(base_url):
    a = Api(base_url)
    a.auth("broker1@test.com")
    return a


@pytest.fixture
def broker2_api(base_url):
    a = Api(base_url)
    a.auth("broker2@test.com")
    return a


@pytest.fixture
def contractor1_api(base_url):
    a = Api(base_url)
    a.auth("contractor1@test.com")
    return a


@pytest.fixture
def contractor2_api(base_url):
    a = Api(base_url)
    a.auth("contractor2@test.com")
    return a


@pytest.fixture
def client1_api(base_url):
    a = Api(base_url)
    a.auth("client1@test.com")
    return a
