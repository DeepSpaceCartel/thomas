Feature: BDD Framework for the rest-api test fixture's Files CRUD (full syntax)
  As a DevOps engineer
  I want to exercise a real multipart upload, a real byte-exact
  download, and a real delete against a deployed app's own API
  So that I can trust binary content round-trips through this
  framework's HTTP mechanism, not just JSON

  Scenario: Uploading, downloading, and deleting a File
    Given Directory "<RestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<RestApiHelmChart>" in "<RestApiChartDirectory>"
    And Helm Release "<FilesRelease>" of "<RestApiHelmChart>" named "thomas-files-release" in "thomas-helm-test"
    When I upgrade Helm Release known as "<FilesRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic            | True  |
      | --create-namespace  | True  |
    Then the command exited with 0

    Given Service known as "<FilesService>":
      | PROPERTY                   | VALUE                  |
      | namespace                  | thomas-helm-test     |
      | app.kubernetes.io/instance | thomas-files-release   |
    And HTTP Endpoint known as "<FilesApi>":
      | PROPERTY | VALUE          |
      | service  | <FilesService> |
      | port     | 8000           |

    When I send a POST request to Endpoint known as "<FilesApi>" path "/files/" with:
      | TYPE | KEY  | VALUE                        |
      | FILE | file | features/fixtures/hello.txt |
    Then the response status is 201
    Then the command result data has:
      | KEY      | CONDITION | VALUE      |
      | filename | equals    | hello.txt  |

    Given the value at "id" from the last response is known as "<FileId>"

    When I send a GET request to Endpoint known as "<FilesApi>" path "/files/<FileId>"
    Then the response status is 200
    Then the command result data has:
      | KEY      | CONDITION | VALUE     |
      | filename | equals    | hello.txt |

    When I send a GET request to Endpoint known as "<FilesApi>" path "/files/<FileId>/download"
    Then the response status is 200
    Then the response body equals the real bytes of "features/fixtures/hello.txt"
    Then the response headers has:
      | KEY                | CONDITION | VALUE     |
      | content-disposition | contains | hello.txt |

    When I send a DELETE request to Endpoint known as "<FilesApi>" path "/files/<FileId>"
    Then the response status is 204

    When I send a GET request to Endpoint known as "<FilesApi>" path "/files/<FileId>/download"
    Then the response status is 404

    When I uninstall Helm Release known as "<FilesRelease>"
    Then the command exited with 0
