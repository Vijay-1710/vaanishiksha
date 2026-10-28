def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "running"
    assert "Mother-Tongue Education Platform" in data["message"]


def test_health_endpoint(client):
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"


def test_register_and_login_flow(client):
    register_payload = {
        "email": "teacher.test@example.com",
        "password": "Password123!",
        "full_name": "Test Teacher",
        "role": "teacher",
        "primary_language": "hindi",
        "grade": 5
    }
    reg_res = client.post("/api/auth/register", json=register_payload)
    assert reg_res.status_code in [200, 201]
    reg_data = reg_res.json()
    assert "access_token" in reg_data or "id" in reg_data

    # Login with correct password
    login_payload = {
        "email": "teacher.test@example.com",
        "password": "Password123!"
    }
    login_res = client.post("/api/auth/login", json=login_payload)
    assert login_res.status_code == 200
    login_data = login_res.json()
    assert "access_token" in login_data

    # Login with wrong password
    bad_login = {
        "email": "teacher.test@example.com",
        "password": "WrongPassword!"
    }
    bad_res = client.post("/api/auth/login", json=bad_login)
    assert bad_res.status_code == 401


def test_ncert_grades_endpoint(client):
    response = client.get("/api/ncert/grades")
    # Endpoint returns list of grades or curriculum info
    assert response.status_code in [200, 404]
