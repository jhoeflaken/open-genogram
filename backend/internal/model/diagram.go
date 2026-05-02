package model

import "time"

type Sex string

const (
	SexMale    Sex = "male"
	SexFemale  Sex = "female"
	SexUnknown Sex = "unknown"
)

type RelationType string

const (
	RelationPartner     RelationType = "partner"
	RelationDivorce     RelationType = "divorce"
	RelationParentChild RelationType = "parent-child"
	RelationAdoption    RelationType = "adoption"
)

type Position struct {
	X float64 `json:"x"`
	Y float64 `json:"y"`
}

type PersonData struct {
	Name      string `json:"name"`
	Sex       Sex    `json:"sex"`
	BirthDate string `json:"birthDate,omitempty"`
	DeathDate string `json:"deathDate,omitempty"`
	Deceased  bool   `json:"deceased"`
	Notes     string `json:"notes,omitempty"`
}

type Node struct {
	ID       string     `json:"id"`
	Type     string     `json:"type"`
	Position Position   `json:"position"`
	Data     PersonData `json:"data"`
}

type EdgeData struct {
	Relation RelationType `json:"relation"`
}

type Edge struct {
	ID     string   `json:"id"`
	Type   string   `json:"type"`
	Source string   `json:"source"`
	Target string   `json:"target"`
	Data   EdgeData `json:"data"`
}

type Diagram struct {
	ID        string    `json:"id"`
	Name      string    `json:"name"`
	Nodes     []Node    `json:"nodes"`
	Edges     []Edge    `json:"edges"`
	UpdatedAt time.Time `json:"updatedAt"`
}
