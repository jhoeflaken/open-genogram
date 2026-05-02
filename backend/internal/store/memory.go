package store

import (
	"context"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"

	"genogram/backend/internal/model"
)

type MemoryStore struct {
	mu       sync.RWMutex
	diagrams map[string]model.Diagram
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{diagrams: map[string]model.Diagram{}}
}

func (s *MemoryStore) CreateDiagram(_ context.Context, diagram model.Diagram) (model.Diagram, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if diagram.ID == "" {
		diagram.ID = uuid.NewString()
	}
	diagram.UpdatedAt = time.Now().UTC()
	s.diagrams[diagram.ID] = diagram
	return diagram, nil
}

func (s *MemoryStore) GetDiagram(_ context.Context, id string) (model.Diagram, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	d, ok := s.diagrams[id]
	if !ok {
		return model.Diagram{}, ErrNotFound
	}
	return d, nil
}

func (s *MemoryStore) UpdateDiagram(_ context.Context, id string, diagram model.Diagram) (model.Diagram, error) {
	s.mu.Lock()
	defer s.mu.Unlock()

	if _, ok := s.diagrams[id]; !ok {
		return model.Diagram{}, ErrNotFound
	}
	diagram.ID = id
	diagram.UpdatedAt = time.Now().UTC()
	s.diagrams[id] = diagram
	return diagram, nil
}

func (s *MemoryStore) ListDiagrams(_ context.Context, nameFilter string) ([]model.DiagramSummary, error) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	filter := strings.ToLower(nameFilter)
	out := make([]model.DiagramSummary, 0, len(s.diagrams))
	for _, d := range s.diagrams {
		if filter == "" || strings.Contains(strings.ToLower(d.Name), filter) {
			out = append(out, model.DiagramSummary{ID: d.ID, Name: d.Name, UpdatedAt: d.UpdatedAt})
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].UpdatedAt.After(out[j].UpdatedAt) })
	return out, nil
}

func (s *MemoryStore) GetPerson(ctx context.Context, diagramID, personID string) (model.PersonData, error) {
	d, err := s.GetDiagram(ctx, diagramID)
	if err != nil {
		return model.PersonData{}, err
	}

	for _, node := range d.Nodes {
		if node.ID == personID {
			return node.Data, nil
		}
	}
	return model.PersonData{}, ErrNotFound
}

func (s *MemoryStore) UpdatePerson(ctx context.Context, diagramID, personID string, person model.PersonData) (model.Diagram, error) {
	d, err := s.GetDiagram(ctx, diagramID)
	if err != nil {
		return model.Diagram{}, err
	}

	found := false
	for i := range d.Nodes {
		if d.Nodes[i].ID == personID {
			d.Nodes[i].Data = person
			found = true
			break
		}
	}
	if !found {
		return model.Diagram{}, ErrNotFound
	}

	return s.UpdateDiagram(ctx, diagramID, d)
}
