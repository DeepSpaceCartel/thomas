Feature: BDD Framework for the rest-api fixture's Users CRUD (short syntax)
  Scenario: Creating and managing a user with credentials
    Given Directory "<RestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<RestApiHelmChart>" in "<RestApiChartDirectory>"
    And Helm Release "<UsersRelease>" of "<RestApiHelmChart>" named "thomas-users-release" in "thomas-helm-test"
    When I upgrade Helm Release "<UsersRelease>" with --install --atomic --create-namespace
    Then the command exited with 0

    Given Service "<UsersService>"
    And "<UsersService>" namespace is "thomas-helm-test"
    And "<UsersService>" label "app.kubernetes.io/instance" is "thomas-users-release"
    And HTTP Endpoint "<UsersApi>" on "<UsersService>" port "8000"

    Given "<NewLifecycleUser>" has FIELD "username" "lifecycle-user"
    And "<NewLifecycleUser>" has FIELD "password" "secret"
    And "<NewLifecycleUser>" has FIELD "api_key_enabled" "true"
    And "<NewLifecycleUser>" has FIELD "bearer_enabled" "true"
    When I send "<NewLifecycleUser>" as POST to Endpoint known as "<UsersApi>" path "/users/"
    Then the response status is 201
    Then the command result has "username" is lifecycle-user
    Then the command result has "username" exists
    Then the command result has "password_hash" undefined

    Given the value at "id" from the last response is known as "<UserId>"
    Given the value at "api_key" from the last response is known as "<ApiKey>"

    When I send a GET request to Endpoint known as "<UsersApi>" path "/users/<UserId>"
    Then the response status is 200
    Then the command result has "username" is lifecycle-user

    Given "<RenamedUser>" has FIELD "username" "renamed-user"
    When I send "<RenamedUser>" as PUT to Endpoint known as "<UsersApi>" path "/users/<UserId>"
    Then the response status is 200
    Then the command result has "username" is renamed-user
    Then the command result has "api_key_enabled" is true

    When I send a POST request to Endpoint known as "<UsersApi>" path "/users/<UserId>/api-key"
    Then the response status is 200
    # `contains ""` in the original table was vacuously true for any
    # string (every string contains "") - `exists` is the real assertion
    # it was standing in for.
    Then the command result has "api_key" exists
    Then the command result has "username" is renamed-user

    When I send a DELETE request to Endpoint known as "<UsersApi>" path "/users/<UserId>"
    Then the response status is 204

    When I send a GET request to Endpoint known as "<UsersApi>" path "/users/<UserId>"
    Then the response status is 404

    When I uninstall Helm Release known as "<UsersRelease>"
    Then the command exited with 0
