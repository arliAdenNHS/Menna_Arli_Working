from tests.conftest import test_client as client


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_item_crud():
    r = client.post("/api/items", json={"title": "First"})
    assert r.status_code == 201
    item_id = r.json()["id"]

    assert client.get(f"/api/items/{item_id}").json()["title"] == "First"

    r = client.patch(f"/api/items/{item_id}", json={"description": "hello"})
    assert r.json()["description"] == "hello"

    assert client.delete(f"/api/items/{item_id}").status_code == 204
    assert client.get(f"/api/items/{item_id}").status_code == 404
