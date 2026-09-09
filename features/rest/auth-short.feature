Feature: BDD Framework for the rest-api fixture's five auth methods (short syntax)
  Scenario: API key, Basic, Bearer, OAuth2, and OpenID Connect authentication
    Given Directory "<RestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<RestApiHelmChart>" in "<RestApiChartDirectory>"
    And Helm Release "<AuthRelease>" of "<RestApiHelmChart>" named "thomas-auth-release" in "thomas-helm-test"
    When I upgrade Helm Release "<AuthRelease>" with --install --atomic --create-namespace
    Then the command exited with 0

    Given Service "<AuthService>"
    And "<AuthService>" namespace is "thomas-helm-test"
    And "<AuthService>" label "app.kubernetes.io/instance" is "thomas-auth-release"
    And HTTP Endpoint "<AuthApi>" on "<AuthService>" port "8000"

    Given "<NewAuthUser>" has FIELD "username" "phase3-user"
    And "<NewAuthUser>" has FIELD "password" "secret"
    And "<NewAuthUser>" has FIELD "api_key_enabled" "true"
    And "<NewAuthUser>" has FIELD "bearer_enabled" "true"
    When I send "<NewAuthUser>" as POST to Endpoint known as "<AuthApi>" path "/users/"
    Then the response status is 201
    Given the value at "api_key" from the last response is known as "<ApiKey>"

    When I send a GET request to Endpoint known as "<AuthApi>" path "/auth/api-key/whoami" with header "X-API-Key" "<ApiKey>"
    Then the response status is 200
    Then the command result has "username" is phase3-user

    When I send a GET request to Endpoint known as "<AuthApi>" path "/auth/api-key/whoami" with header "X-API-Key" "invalid-key"
    Then the response status is 401

    When I send a GET request to Endpoint known as "<AuthApi>" path "/auth/basic/whoami" with basic auth "phase3-user" "secret"
    Then the response status is 200
    Then the command result has "username" is phase3-user

    Given "<PasswordTokenRequest>" has HEADER "Content-Type" "application/x-www-form-urlencoded"
    And "<PasswordTokenRequest>" has BODY "" "username=phase3-user&password=secret"
    When I send "<PasswordTokenRequest>" as POST to Endpoint known as "<AuthApi>" path "/auth/token"
    Then the response status is 200
    Given the value at "access_token" from the last response is known as "<BearerToken>"

    When I send a GET request to Endpoint known as "<AuthApi>" path "/auth/bearer/whoami" with header "Authorization" "Bearer <BearerToken>"
    Then the response status is 200
    Then the command result has "username" is phase3-user

    Given "<AuthorizeRequest>" has QUERY "client_id" "thomas-client"
    And "<AuthorizeRequest>" has QUERY "redirect_uri" "https://client.example/callback"
    And "<AuthorizeRequest>" has QUERY "response_type" "code"
    And "<AuthorizeRequest>" has QUERY "scope" "openid profile"
    And "<AuthorizeRequest>" has QUERY "state" "phase3-state"
    And "<AuthorizeRequest>" has QUERY "username" "phase3-user"
    And "<AuthorizeRequest>" has QUERY "password" "secret"
    When I send "<AuthorizeRequest>" as GET to Endpoint known as "<AuthApi>" path "/oauth/authorize"
    Then the response status is 302
    Then the response header "location" contains https://client.example/callback?code=
    Given the query parameter "code" from response header "location" is known as "<AuthCode>"

    Given "<OAuthTokenRequest>" has HEADER "Content-Type" "application/x-www-form-urlencoded"
    And "<OAuthTokenRequest>" has BODY "" "grant_type=authorization_code&code=<AuthCode>&client_id=thomas-client&redirect_uri=https://client.example/callback"
    When I send "<OAuthTokenRequest>" as POST to Endpoint known as "<AuthApi>" path "/oauth/token"
    Then the response status is 200
    Given the value at "access_token" from the last response is known as "<OAuthAccessToken>"
    Given the value at "id_token" from the last response is known as "<IdToken>"

    When I send a GET request to Endpoint known as "<AuthApi>" path "/auth/oauth2/whoami" with header "Authorization" "Bearer <OAuthAccessToken>"
    Then the response status is 200

    When I send a GET request to Endpoint known as "<AuthApi>" path "/oauth/userinfo" with header "Authorization" "Bearer <OAuthAccessToken>"
    Then the response status is 200
    Then the command result has "preferred_username" is phase3-user

    When I send a GET request to Endpoint known as "<AuthApi>" path "/auth/openid/whoami" with header "Authorization" "Bearer <IdToken>"
    Then the response status is 200

    When I send a GET request to Endpoint known as "<AuthApi>" path "/.well-known/openid-configuration"
    Then the response status is 200
    Then the command result has "response_types_supported[0]" is code
    Then the command result has "id_token_signing_alg_values_supported[0]" is RS256

    When I uninstall Helm Release known as "<AuthRelease>"
    Then the command exited with 0
