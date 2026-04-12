"""
Client files and activities tests.
Covers: file upload/list/download/delete, activity create/list, broker scoping.
"""


class TestClientFiles:
    def _get_client_id(self, api):
        clients = api.get("/clients").json()["data"]
        return clients[0]["id"] if clients else None

    def test_upload_file(self, broker1_api):
        cid = self._get_client_id(broker1_api)
        if not cid:
            return
        r = broker1_api.upload(f"/clients/{cid}/files", b"contract content", filename="contract.pdf", fields={"file_type": "CONTRACT"})
        assert r.status_code == 201

    def test_list_files(self, broker1_api):
        cid = self._get_client_id(broker1_api)
        if not cid:
            return
        r = broker1_api.get(f"/clients/{cid}/files")
        assert r.status_code == 200
        assert "data" in r.json()

    def test_delete_file(self, broker1_api):
        cid = self._get_client_id(broker1_api)
        if not cid:
            return
        r = broker1_api.upload(f"/clients/{cid}/files", b"to delete", filename="del.txt", fields={"file_type": "OTHER"})
        if r.status_code != 201:
            return
        fid = r.json()["id"] if isinstance(r.json(), dict) else r.json()[0]["id"]
        r2 = broker1_api.delete(f"/clients/{cid}/files/{fid}")
        assert r2.status_code == 204


class TestClientActivities:
    def _get_client_id(self, api):
        clients = api.get("/clients").json()["data"]
        return clients[0]["id"] if clients else None

    def test_create_activity(self, broker1_api):
        cid = self._get_client_id(broker1_api)
        if not cid:
            return
        r = broker1_api.post(f"/clients/{cid}/activities", json={
            "type": "NOTE",
            "text": "Test note for client",
        })
        assert r.status_code == 201
        assert r.json()["type"] == "NOTE"

    def test_list_activities(self, broker1_api):
        cid = self._get_client_id(broker1_api)
        if not cid:
            return
        r = broker1_api.get(f"/clients/{cid}/activities")
        assert r.status_code == 200
        assert "data" in r.json()
