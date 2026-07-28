import pytest


@pytest.mark.asyncio
async def test_create_project(client):
    res = await client.post("/api/projects", json={
        "name": "测试小说",
        "genre": "玄幻",
        "concept": "一个穿越修仙的故事",
        "target_words": 200000,
    })
    assert res.status_code in (200, 201)
    body = res.json()
    assert body["name"] == "测试小说"
    assert "id" in body


@pytest.mark.asyncio
async def test_list_projects(client):
    await client.post("/api/projects", json={
        "name": "小说1",
        "genre": "都市",
        "concept": "故事",
        "target_words": 100000,
    })
    res = await client.get("/api/projects")
    assert res.status_code == 200
    body = res.json()
    assert len(body) >= 1


@pytest.mark.asyncio
async def test_get_project(client):
    create_res = await client.post("/api/projects", json={
        "name": "获取测试",
        "genre": "言情",
        "concept": "言情故事",
        "target_words": 50000,
    })
    project_id = create_res.json()["id"]
    res = await client.get(f"/api/projects/{project_id}")
    assert res.status_code == 200
    assert res.json()["name"] == "获取测试"


@pytest.mark.asyncio
async def test_delete_project(client):
    create_res = await client.post("/api/projects", json={
        "name": "删除测试",
        "genre": "悬疑",
        "concept": "悬疑故事",
        "target_words": 80000,
    })
    project_id = create_res.json()["id"]
    res = await client.delete(f"/api/projects/{project_id}")
    assert res.status_code == 200

    res = await client.get(f"/api/projects/{project_id}")
    assert res.status_code == 404
