from tests.conftest import test_client as client


def test_get_rankings_external():
    res = client.get("/api/v1/rankings/fantasy.json")
    assert res.status_code == 200
    data = res.json()
    assert data["category"] == "fantasy"
    books = data.get("items") or data.get("books")
    assert len(books) >= 1

    first_book = books[0]
    assert first_book["rank"] == 1
    assert "slug" in first_book
    assert "score" in first_book


def test_get_book_detail_external():
    res = client.get("/api/v1/books/the-name-of-the-wind.json")
    assert res.status_code == 200
    book = res.json()
    assert book["slug"] == "the-name-of-the-wind"
    assert "title" in book
    assert "score" in book
    assert "reviews" in book


def test_post_review_and_vote():
    slug = "the-name-of-the-wind"
    payload = {
        "rating": 5,
        "comment": "Told in Kvothe's own voice, an unforgettable journey!",
        "reviewer_name": "KvotheFan",
    }
    review_res = client.post(f"/api/v1/books/{slug}/reviews", json=payload)
    assert review_res.status_code == 201
    rev_data = review_res.json()
    assert rev_data["rating"] == 5
    assert rev_data["reviewer_name"] == "KvotheFan"
    assert rev_data["book_slug"] == slug
    assert "id" in rev_data

    # Verify review shows up in book detail
    detail_res = client.get(f"/api/v1/books/{slug}.json")
    assert detail_res.status_code == 200
    book_data = detail_res.json()
    assert any(r["comment"] == payload["comment"] for r in book_data["reviews"])


def test_invalid_review_rating():
    slug = "the-name-of-the-wind"
    # Rating outside 1-5
    bad_res = client.post(
        f"/api/v1/books/{slug}/reviews",
        json={"rating": 10, "comment": "Too high rating!"},
    )
    assert bad_res.status_code == 422


def test_html_pages_served():
    r_rankings = client.get("/rankings")
    assert r_rankings.status_code == 200
    assert "Algorithmic Book Rankings" in r_rankings.text

    r_book = client.get("/books/the-name-of-the-wind")
    assert r_book.status_code == 200
    assert "Reader Reviews & Ratings" in r_book.text
