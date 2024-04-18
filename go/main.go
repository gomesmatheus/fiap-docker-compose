package main

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"

	"github.com/jackc/pgx/v5"
)

const(
    createPersons = `
        CREATE TABLE IF NOT EXISTS persons (
            id SERIAL PRIMARY KEY,
            name VARCHAR(255) NOT NULL,
            email VARCHAR(255) NOT NULL
        );
    `
)

type Person struct {
    Name string `json:"name"`
    Email string `json:"email"`
}

type PersonModel struct {
    Id int `json:"id"`
    Name string `json:"name"`
    Email string `json:"email"`
}

var db *pgx.Conn

func main() {
	fmt.Println("ABC")
    err := initDb()
    if err != nil {
        log.Fatalf("Error initializing database: %v", err)
    }


    http.HandleFunc("/person", handleRoute)
    log.Fatal(http.ListenAndServe(":3333", nil))

}

func initDb() (err error) {
    url := "postgres://postgres:123@postgres-db:5432/postgres"

    config, err := pgx.ParseConfig(url)
    if err != nil {
        fmt.Println("Error parsing config", err)
        return err
    }

    db, err = pgx.ConnectConfig(context.Background(), config)
    if err != nil {
        fmt.Println("Error creating database connection", err)
        return err
    }
    
    if _, err := db.Exec(context.Background(), createPersons); err != nil {
        fmt.Println("Error creating table Persons", err)
        return err
    }
    
    return nil
}

func handleRoute(w http.ResponseWriter, r *http.Request) {
    if r.Method == "POST" {
        body, err := io.ReadAll(r.Body)
        defer r.Body.Close()
        if err != nil {
            fmt.Println("Error parsing request body")
            w.WriteHeader(400)
            w.Write([]byte("400 bad request"))
        }

        var person Person
        json.Unmarshal(body, &person)

        fmt.Println(person)
        response, _ := json.Marshal(person)
        
        err = insertPerson(person)
        if err != nil {
            fmt.Println("Error inserting person on database")
            w.WriteHeader(500)
            w.Write([]byte("500 internal server error"))
        }


        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(200)
        w.Write(response)
        return
    } else if r.Method == "GET" {
        persons, err := readPersons()
        if err != nil {
            fmt.Println("Error reading persons from database")
            w.WriteHeader(500)
            w.Write([]byte("500 internal server error"))
        }

        response, _ := json.Marshal(persons)
        w.Header().Set("Content-Type", "application/json")
        w.WriteHeader(200)
        w.Write(response)
    }
}

func insertPerson(person Person) error {
    _, err := db.Exec(context.Background(), "INSERT INTO persons (name, email) VALUES ($1, $2)", person.Name, person.Email)
    return err
}

func readPersons() ([]PersonModel, error) {
    var persons []PersonModel
    rows, err := db.Query(context.Background(), "SELECT id, name, email FROM persons")

    for rows.Next() {
        var p PersonModel
        if err = rows.Scan(&p.Id, &p.Name, &p.Email); err != nil {
            fmt.Println("Error scaning", err)
            return nil, err
        }

        persons = append(persons, p)
    }

    return persons, err
}

