package httpapi

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"genogram/backend/internal/model"
	"genogram/backend/internal/store"
)

func TestCreateAndFetchDiagram(t *testing.T) {
	h := NewHandler(store.NewMemoryStore())

	payload := model.Diagram{
		Name: "test-family",
		Nodes: []model.Node{{
			ID:       "p1",
			Type:     "person",
			Position: model.Position{X: 100, Y: 100},
			Data:     model.PersonData{Name: "Alice", Sex: model.SexFemale},
		}},
	}

	b, _ := json.Marshal(payload)
	createReq := httptest.NewRequest(http.MethodPost, "/api/diagrams", bytes.NewReader(b))
	createRec := httptest.NewRecorder()
	h.Routes().ServeHTTP(createRec, createReq)

	if createRec.Code != http.StatusCreated {
		t.Fatalf("expected 201, got %d", createRec.Code)
	}

	var created model.Diagram
	if err := json.NewDecoder(createRec.Body).Decode(&created); err != nil {
		t.Fatalf("decode create response: %v", err)
	}
	if created.ID == "" {
		t.Fatal("expected generated ID")
	}

	getReq := httptest.NewRequest(http.MethodGet, "/api/diagrams/"+created.ID, nil)
	getRec := httptest.NewRecorder()
	h.Routes().ServeHTTP(getRec, getReq)

	if getRec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", getRec.Code)
	}

	var fetched model.Diagram
	if err := json.NewDecoder(getRec.Body).Decode(&fetched); err != nil {
		t.Fatalf("decode get response: %v", err)
	}
	if fetched.Name != payload.Name {
		t.Fatalf("expected name %q, got %q", payload.Name, fetched.Name)
	}
}

func TestUpdatePerson(t *testing.T) {
	store := store.NewMemoryStore()
	h := NewHandler(store)

	d, err := store.CreateDiagram(nil, model.Diagram{
		Name:  "person-update",
		Nodes: []model.Node{{ID: "p1", Type: "person", Data: model.PersonData{Name: "Bob", Sex: model.SexMale}}},
	})
	if err != nil {
		t.Fatalf("create seed diagram: %v", err)
	}

	update := model.PersonData{Name: "Robert", Sex: model.SexMale, Notes: "Updated"}
	b, _ := json.Marshal(update)
	req := httptest.NewRequest(http.MethodPut, "/api/diagrams/"+d.ID+"/persons/p1", bytes.NewReader(b))
	rec := httptest.NewRecorder()
	h.Routes().ServeHTTP(rec, req)

	if rec.Code != http.StatusOK {
		t.Fatalf("expected 200, got %d", rec.Code)
	}

	p, err := store.GetPerson(nil, d.ID, "p1")
	if err != nil {
		t.Fatalf("get person from store: %v", err)
	}
	if p.Name != "Robert" {
		t.Fatalf("expected updated name, got %q", p.Name)
	}
}
