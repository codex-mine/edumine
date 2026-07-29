async def test_health(anon_client):
    resp = await anon_client.get("/api/v1/health")
    assert resp.status_code == 200


async def test_login_all_roles(role_clients):
    for role, client in role_clients.items():
        resp = await client.get("/api/v1/auth/me")
        assert resp.status_code == 200
        assert resp.json()["data"]["role"] == role
