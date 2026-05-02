package store

import (
	"context"
	"encoding/json"
	"errors"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
	"github.com/jackc/pgx/v5/pgxpool"

	"genogram/backend/internal/model"
)

type PostgresStore struct {
	pool *pgxpool.Pool
}

func NewPostgresStore(pool *pgxpool.Pool) *PostgresStore {
	return &PostgresStore{pool: pool}
}

func (s *PostgresStore) CreateDiagram(ctx context.Context, diagram model.Diagram) (model.Diagram, error) {
	if diagram.ID == "" {
		diagram.ID = uuid.NewString()
	}
	diagram.UpdatedAt = time.Now().UTC()

	payload, err := json.Marshal(diagram)
	if err != nil {
		return model.Diagram{}, err
	}

	_, err = s.pool.Exec(ctx,
		`INSERT INTO diagrams (id, name, data, created_at, updated_at) VALUES ($1, $2, $3::jsonb, NOW(), NOW())`,
		diagram.ID, diagram.Name, payload,
	)
	if err != nil {
		return model.Diagram{}, err
	}
	return diagram, nil
}

func (s *PostgresStore) GetDiagram(ctx context.Context, id string) (model.Diagram, error) {
	var raw []byte
	err := s.pool.QueryRow(ctx, `SELECT data FROM diagrams WHERE id = $1`, id).Scan(&raw)
	if errors.Is(err, pgx.ErrNoRows) {
		return model.Diagram{}, ErrNotFound
	}
	if err != nil {
		return model.Diagram{}, err
	}

	var d model.Diagram
	if err := json.Unmarshal(raw, &d); err != nil {
		return model.Diagram{}, err
	}
	return d, nil
}

func (s *PostgresStore) UpdateDiagram(ctx context.Context, id string, diagram model.Diagram) (model.Diagram, error) {
	diagram.ID = id
	diagram.UpdatedAt = time.Now().UTC()
	payload, err := json.Marshal(diagram)
	if err != nil {
		return model.Diagram{}, err
	}

	cmd, err := s.pool.Exec(ctx, `UPDATE diagrams SET name = $2, data = $3::jsonb, updated_at = NOW() WHERE id = $1`, id, diagram.Name, payload)
	if err != nil {
		return model.Diagram{}, err
	}
	if cmd.RowsAffected() == 0 {
		return model.Diagram{}, ErrNotFound
	}
	return diagram, nil
}

func (s *PostgresStore) GetPerson(ctx context.Context, diagramID, personID string) (model.PersonData, error) {
	d, err := s.GetDiagram(ctx, diagramID)
	if err != nil {
		return model.PersonData{}, err
	}
	for _, n := range d.Nodes {
		if n.ID == personID {
			return n.Data, nil
		}
	}
	return model.PersonData{}, ErrNotFound
}

func (s *PostgresStore) UpdatePerson(ctx context.Context, diagramID, personID string, person model.PersonData) (model.Diagram, error) {
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
