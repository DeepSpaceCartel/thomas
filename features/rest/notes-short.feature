Feature: BDD Framework for the rest-api test fixture's Notes CRUD (short syntax)
  As a DevOps engineer
  I want to exercise real create/read/update/delete round trips against
  a deployed app's own JSON API, using a value the server generated
  (a created note's real id) in later requests
  So that I can trust dynamic-value capture before building auth on top

  Scenario: Creating, reading, updating, and deleting a Note
    Given Directory "<RestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<RestApiHelmChart>" in "<RestApiChartDirectory>"
    And Helm Release "<NotesRelease>" of "<RestApiHelmChart>" named "thomas-notes-release" in "thomas-helm-test"
    When I upgrade Helm Release "<NotesRelease>" with --install --atomic --create-namespace
    Then the command exited with 0

    Given Service "<NotesService>"
    And "<NotesService>" namespace is "thomas-helm-test"
    And "<NotesService>" label "app.kubernetes.io/instance" is "thomas-notes-release"
    And HTTP Endpoint "<NotesApi>" on "<NotesService>" port "8000"

    Given "<NewGroceryNote>" has FIELD "title" "Groceries"
    And "<NewGroceryNote>" has FIELD "body" "Milk, eggs"
    When I send "<NewGroceryNote>" as POST to Endpoint known as "<NotesApi>" path "/notes/"
    Then the response status is 201
    Then the command result has "title" is Groceries
    Then the command result has "body" is "Milk, eggs"

    Given the value at "id" from the last response is known as "<NoteId>"

    When I send a GET request to Endpoint known as "<NotesApi>" path "/notes/<NoteId>"
    Then the response status is 200
    Then the command result has "title" is Groceries
    Then the command result has "body" is "Milk, eggs"

    Given "<UpdatedGroceryNote>" has FIELD "title" "Groceries v2"
    And "<UpdatedGroceryNote>" has FIELD "body" "Milk, eggs, bread"
    When I send "<UpdatedGroceryNote>" as PUT to Endpoint known as "<NotesApi>" path "/notes/<NoteId>"
    Then the response status is 200
    Then the command result has "title" is "Groceries v2"
    Then the command result has "body" is "Milk, eggs, bread"

    When I send a GET request to Endpoint known as "<NotesApi>" path "/notes/<NoteId>"
    Then the command result has "title" is "Groceries v2"

    # PATCH only supplies "title" - proves a genuine partial update, not
    # PUT's full replace: "body" must survive untouched.
    Given "<GroceryNoteTitlePatch>" has FIELD "title" "Groceries v3"
    When I send "<GroceryNoteTitlePatch>" as PATCH to Endpoint known as "<NotesApi>" path "/notes/<NoteId>"
    Then the response status is 200
    Then the command result has "title" is "Groceries v3"
    Then the command result has "body" is "Milk, eggs, bread"

    When I send a DELETE request to Endpoint known as "<NotesApi>" path "/notes/<NoteId>"
    Then the response status is 204

    When I send a GET request to Endpoint known as "<NotesApi>" path "/notes/<NoteId>"
    Then the response status is 404

    When I uninstall Helm Release known as "<NotesRelease>"
    Then the command exited with 0

  Scenario: Rejecting a request for a Note that was never created
    Given Directory "<RestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<RestApiHelmChart>" in "<RestApiChartDirectory>"
    And Helm Release "<NotesMissingRelease>" of "<RestApiHelmChart>" named "thomas-notes-missing-release" in "thomas-helm-test"
    When I upgrade Helm Release "<NotesMissingRelease>" with --install --atomic --create-namespace
    Then the command exited with 0

    Given Service "<NotesMissingService>"
    And "<NotesMissingService>" namespace is "thomas-helm-test"
    And "<NotesMissingService>" label "app.kubernetes.io/instance" is "thomas-notes-missing-release"
    And HTTP Endpoint "<NotesMissingApi>" on "<NotesMissingService>" port "8000"

    When I send a GET request to Endpoint known as "<NotesMissingApi>" path "/notes/no-such-note"
    Then the response status is 404 BODY contains "note not found"

    When I uninstall Helm Release known as "<NotesMissingRelease>"
    Then the command exited with 0
