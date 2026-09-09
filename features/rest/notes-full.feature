Feature: BDD Framework for the rest-api test fixture's Notes CRUD (full syntax)
  As a DevOps engineer
  I want to exercise real create/read/update/delete round trips against
  a deployed app's own JSON API, using a value the server generated
  (a created note's real id) in later requests
  So that I can trust dynamic-value capture before building auth on top

  Scenario: Creating, reading, updating, and deleting a Note
    Given Directory "<RestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<RestApiHelmChart>" in "<RestApiChartDirectory>"
    And Helm Release "<NotesRelease>" of "<RestApiHelmChart>" named "thomas-notes-release" in "thomas-helm-test"
    When I upgrade Helm Release known as "<NotesRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic            | True  |
      | --create-namespace  | True  |
    Then the command exited with 0

    Given Service known as "<NotesService>":
      | PROPERTY                   | VALUE                  |
      | namespace                  | thomas-helm-test     |
      | app.kubernetes.io/instance | thomas-notes-release   |
    And HTTP Endpoint "<NotesApi>" on "<NotesService>" port "8000"

    When I send a POST request to Endpoint known as "<NotesApi>" path "/notes/" with:
      | TYPE  | KEY   | VALUE      |
      | FIELD | title | Groceries  |
      | FIELD | body  | Milk, eggs |
    Then the response status is 201
    Then the command result data has:
      | KEY   | CONDITION | VALUE      |
      | title | equals    | Groceries  |
      | body  | equals    | Milk, eggs |

    Given the value at "id" from the last response is known as "<NoteId>"

    When I send a GET request to Endpoint known as "<NotesApi>" path "/notes/<NoteId>"
    Then the response status is 200
    Then the command result data has:
      | KEY   | CONDITION | VALUE      |
      | title | equals    | Groceries  |
      | body  | equals    | Milk, eggs |

    When I send a PUT request to Endpoint known as "<NotesApi>" path "/notes/<NoteId>" with:
      | TYPE  | KEY   | VALUE               |
      | FIELD | title | Groceries v2        |
      | FIELD | body  | Milk, eggs, bread   |
    Then the response status is 200
    Then the command result data has:
      | KEY   | CONDITION | VALUE             |
      | title | equals    | Groceries v2      |
      | body  | equals    | Milk, eggs, bread |

    When I send a GET request to Endpoint known as "<NotesApi>" path "/notes/<NoteId>"
    Then the command result data has:
      | KEY   | CONDITION | VALUE        |
      | title | equals    | Groceries v2 |

    # PATCH only supplies "title" - proves a genuine partial update, not
    # PUT's full replace: "body" must survive untouched.
    When I send a PATCH request to Endpoint known as "<NotesApi>" path "/notes/<NoteId>" with:
      | TYPE  | KEY   | VALUE          |
      | FIELD | title | Groceries v3  |
    Then the response status is 200
    Then the command result data has:
      | KEY   | CONDITION | VALUE             |
      | title | equals    | Groceries v3      |
      | body  | equals    | Milk, eggs, bread |

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
    When I upgrade Helm Release known as "<NotesMissingRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic            | True  |
      | --create-namespace  | True  |
    Then the command exited with 0

    Given Service known as "<NotesMissingService>":
      | PROPERTY                   | VALUE                          |
      | namespace                  | thomas-helm-test              |
      | app.kubernetes.io/instance | thomas-notes-missing-release   |
    And HTTP Endpoint "<NotesMissingApi>" on "<NotesMissingService>" port "8000"

    When I send a GET request to Endpoint known as "<NotesMissingApi>" path "/notes/no-such-note"
    Then the response status is 404:
      | SOURCE | CONDITION | VALUE            |
      | BODY   | contains  | note not found   |

    When I uninstall Helm Release known as "<NotesMissingRelease>"
    Then the command exited with 0
