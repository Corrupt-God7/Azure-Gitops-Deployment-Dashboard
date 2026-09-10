from app.main import get_deployment_history


def test_history_is_newest_first_and_marks_current_revision():
    status = {
        "sync": {"revision": "2222222full"},
        "history": [
            {
                "id": 4,
                "revision": "1111111full",
                "deployStartedAt": "2026-09-08T10:00:00Z",
                "deployedAt": "2026-09-08T10:00:08Z",
                "initiatedBy": {"username": "chirag"},
            },
            {
                "id": 5,
                "revision": "2222222full",
                "deployStartedAt": "2026-09-08T11:00:00Z",
                "deployedAt": "2026-09-08T11:00:09Z",
                "initiatedBy": {"automated": True},
            },
        ],
    }

    history = get_deployment_history(status)

    assert [item.id for item in history] == [5, 4]
    assert history[0].revision == "2222222"
    assert history[0].current is True
    assert history[0].initiated_by == "Automated sync"
    assert history[1].current is False
    assert history[1].initiated_by == "chirag"


def test_history_tolerates_incomplete_records_without_inventing_times():
    status = {
        "sync": {"revision": "current"},
        "history": [
            "invalid",
            {"id": "unexpected", "revision": "abcdef123", "initiatedBy": {}},
            {"id": 9, "deployedAt": "2026-09-08T11:00:00Z"},
        ],
    }

    history = get_deployment_history(status)

    assert len(history) == 1
    assert history[0].id == 1
    assert history[0].revision == "abcdef1"
    assert history[0].deployed_at is None
    assert history[0].deploy_started_at is None
    assert history[0].initiated_by == "Unknown"
    assert history[0].current is False


def test_non_list_history_is_reported_as_empty():
    assert get_deployment_history({"history": {"id": 1}}) == []
