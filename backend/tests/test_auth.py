from fastapi.testclient import TestClient
from app.main import app
from app.core.config import settings

client = TestClient(app)

def test_login_invalid_credentials():
    response = client.post(f"{settings.API_V1_STR}/auth/login", json={
        "email": "wrong@example.com",
        "password": "wrongpassword"
    })
    assert response.status_code == 401
    assert response.json()["detail"] == "Incorrect email or password"

def test_protected_route_unauthenticated():
    response = client.get(f"{settings.API_V1_STR}/auth/me")
    assert response.status_code == 401
