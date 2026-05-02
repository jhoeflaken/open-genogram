package httpapi

import (
	"encoding/json"
	"errors"
	"genogram/backend/internal/model"
	"genogram/backend/internal/store"
	"net/http"

	"github.com/go-chi/chi/v5"
)

type Handler struct {
	store store.DiagramStore
}

func NewHandler(s store.DiagramStore) *Handler {
	return &Handler{store: s}
}
func (h *Handler) Routes() http.Handler {
	r := chi.NewRouter()
	r.Get("/health", func(w http.ResponseWriter, _ *http.Request) {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
	})
	r.Route("/api", func(api chi.Router) {
		api.Get("/diagrams", h.listDiagrams)
		api.Post("/diagrams", h.createDiagram)
		api.Get("/diagrams/{diagramId}", h.getDiagram)
		api.Put("/diagrams/{diagramId}", h.updateDiagram)
		api.Get("/diagrams/{diagramId}/persons/{personId}", h.getPerson)
		api.Put("/diagrams/{diagramId}/persons/{personId}", h.updatePerson)
	})
	return r
}
func (h *Handler) listDiagrams(w http.ResponseWriter, r *http.Request) {
	nameFilter := r.URL.Query().Get("name")
	summaries, err := h.store.ListDiagrams(r.Context(), nameFilter)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	if summaries == nil {
		summaries = []model.DiagramSummary{}
	}
	writeJSON(w, http.StatusOK, summaries)
}
func (h *Handler) createDiagram(w http.ResponseWriter, r *http.Request) {
	var payload model.Diagram
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	d, err := h.store.CreateDiagram(r.Context(), payload)
	if err != nil {
		writeError(w, http.StatusInternalServerError, err.Error())
		return
	}
	writeJSON(w, http.StatusCreated, d)
}
func (h *Handler) getDiagram(w http.ResponseWriter, r *http.Request) {
	diagramID := chi.URLParam(r, "diagramId")
	d, err := h.store.GetDiagram(r.Context(), diagramID)
	if err != nil {
		h.handleStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, d)
}
func (h *Handler) updateDiagram(w http.ResponseWriter, r *http.Request) {
	diagramID := chi.URLParam(r, "diagramId")
	var payload model.Diagram
	if err := json.NewDecoder(r.Body).Decode(&payload); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	d, err := h.store.UpdateDiagram(r.Context(), diagramID, payload)
	if err != nil {
		h.handleStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, d)
}
func (h *Handler) getPerson(w http.ResponseWriter, r *http.Request) {
	diagramID := chi.URLParam(r, "diagramId")
	personID := chi.URLParam(r, "personId")
	p, err := h.store.GetPerson(r.Context(), diagramID, personID)
	if err != nil {
		h.handleStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, p)
}
func (h *Handler) updatePerson(w http.ResponseWriter, r *http.Request) {
	diagramID := chi.URLParam(r, "diagramId")
	personID := chi.URLParam(r, "personId")
	var person model.PersonData
	if err := json.NewDecoder(r.Body).Decode(&person); err != nil {
		writeError(w, http.StatusBadRequest, "invalid request body")
		return
	}
	d, err := h.store.UpdatePerson(r.Context(), diagramID, personID, person)
	if err != nil {
		h.handleStoreErr(w, err)
		return
	}
	writeJSON(w, http.StatusOK, d)
}
func (h *Handler) handleStoreErr(w http.ResponseWriter, err error) {
	if errors.Is(err, store.ErrNotFound) {
		writeError(w, http.StatusNotFound, err.Error())
		return
	}
	writeError(w, http.StatusInternalServerError, err.Error())
}
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}
func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"error": message})
}
