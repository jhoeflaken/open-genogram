package store

import (
	"context"
	"errors"

	"genogram/backend/internal/model"
)

var ErrNotFound = errors.New("resource not found")

type DiagramStore interface {
	CreateDiagram(ctx context.Context, diagram model.Diagram) (model.Diagram, error)
	GetDiagram(ctx context.Context, id string) (model.Diagram, error)
	UpdateDiagram(ctx context.Context, id string, diagram model.Diagram) (model.Diagram, error)
	GetPerson(ctx context.Context, diagramID, personID string) (model.PersonData, error)
	UpdatePerson(ctx context.Context, diagramID, personID string, person model.PersonData) (model.Diagram, error)
}
