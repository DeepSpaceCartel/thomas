Feature: BDD Framework for the rest-api test fixture's health probes (short syntax)
  As a DevOps engineer
  I want to exercise a real FastAPI app's k8s health-probe endpoints over
  real HTTP using the short oneline and `as {outputFormat}` forms
  So that I can trust the pattern before building CRUD/auth on top of it

  Scenario: All three health endpoints report healthy after a real startup
    Given Directory "<RestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<RestApiHelmChart>" in "<RestApiChartDirectory>"
    And Helm Release "<RestApiRelease>" of "<RestApiHelmChart>" named "thomas-rest-api-release" in "thomas-helm-test"
    When I upgrade Helm Release "<RestApiRelease>" with --install --atomic --create-namespace
    Then the command exited with 0

    Given Service "<RestApiService>"
    And "<RestApiService>" namespace is "thomas-helm-test"
    And "<RestApiService>" label "app.kubernetes.io/instance" is "thomas-rest-api-release"
    And HTTP Endpoint "<RestApi>" on "<RestApiService>" port "8000"

    Given ConfigMap "<RestApiConfigMap>"
    And "<RestApiConfigMap>" namespace is "thomas-helm-test"
    And "<RestApiConfigMap>" label "app.kubernetes.io/instance" is "thomas-rest-api-release"
    When I get ConfigMap "<RestApiConfigMap>" as JSON
    Then the command result has "data.\"notes.py\"" exists
    Then the command result has "data.\"main.py\"" exists

    When I send a GET request to Endpoint known as "<RestApi>" path "/health/startup"
    Then the response status is 200 BODY contains "started":true

    When I send a GET request to Endpoint known as "<RestApi>" path "/health/ready"
    Then the response status is 200
    Then the command result has "ready" is true
    Then the response header "content-type" contains application/json

    When I send a GET request to Endpoint known as "<RestApi>" path "/health/live"
    Then the response status is 200

    When I uninstall Helm Release known as "<RestApiRelease>"
    Then the command exited with 0

  Scenario: Flipping readiness removes the Pod from Service endpoints without restarting it
    Given Directory "<RestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<RestApiHelmChart>" in "<RestApiChartDirectory>"
    And Helm Release "<ReadinessRelease>" of "<RestApiHelmChart>" named "thomas-rest-api-readiness" in "thomas-helm-test"
    When I upgrade Helm Release "<ReadinessRelease>" with --install --atomic --create-namespace
    Then the command exited with 0

    Given Service "<ReadinessService>"
    And "<ReadinessService>" namespace is "thomas-helm-test"
    And "<ReadinessService>" label "app.kubernetes.io/instance" is "thomas-rest-api-readiness"
    And HTTP Endpoint "<ReadinessApi>" on "<ReadinessService>" port "8000"

    When I send a PUT request to Endpoint known as "<ReadinessApi>" path "/_test/ready" with query "ready" "false"
    Then the response status is 200

    Given Pod "<ReadinessPod>"
    And "<ReadinessPod>" namespace is "thomas-helm-test"
    And "<ReadinessPod>" label "app.kubernetes.io/instance" is "thomas-rest-api-readiness"
    When I poll Pod known as "<ReadinessPod>" every "3s" for up to "30s" until:
      | KEY                                       | CONDITION | VALUE | OUTCOME |
      | status.containerStatuses[0].ready         | equals    | false | pass    |
      | status.containerStatuses[0].restartCount  | equals    | 0     | pass    |

    # No follow-up request to /health/ready through the Service Endpoint
    # (it has no backend to reach once NotReady) - but a real HTTP
    # Endpoint straight on the Pod's own IP bypasses the Service
    # entirely, proving the fixture's liveness endpoint really keeps
    # responding even while genuinely NotReady.
    And HTTP Endpoint "<ReadinessPodApi>" on Pod known as "<ReadinessPod>" port "8000"
    When I send a GET request to Endpoint known as "<ReadinessPodApi>" path "/health/live"
    Then the response status is 200

    When I uninstall Helm Release known as "<ReadinessRelease>"
    Then the command exited with 0

  Scenario: Rejecting an unregistered Service alias from an HTTP Endpoint
    Given "<BadEndpointPayload>" field "service" is "<UndefinedRestService>"
    And "<BadEndpointPayload>" field "port" is "8000"
    When I attempt to define HTTP Endpoint known as "<BadEndpoint>" using "<BadEndpointPayload>"
    Then it should have failed with 'No Service registered as "<UndefinedRestService>"'

  Scenario: Rejecting both a service and a pod field on an HTTP Endpoint
    Given "<BadBothPayload>" field "service" is "<UndefinedRestService>"
    And "<BadBothPayload>" field "pod" is "<UndefinedRestPod>"
    And "<BadBothPayload>" field "port" is "8000"
    When I attempt to define HTTP Endpoint known as "<BadEndpoint>" using "<BadBothPayload>"
    Then it should have failed with 'RestEndpoint accepts only one of "service" or "pod", not both'

  Scenario: Rejecting an unregistered Pod alias from an HTTP Endpoint
    Given "<BadPodPayload>" field "pod" is "<UndefinedRestPod>"
    And "<BadPodPayload>" field "port" is "8000"
    When I attempt to define HTTP Endpoint known as "<BadPodEndpoint>" using "<BadPodPayload>"
    Then it should have failed with 'No Pod registered as "<UndefinedRestPod>"'

  Scenario: Reaching a real self-signed TLS listener over HTTPS
    Given Directory "<TlsRestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<TlsRestApiHelmChart>" in "<TlsRestApiChartDirectory>"
    And Helm Release "<TlsRestApiRelease>" of "<TlsRestApiHelmChart>" named "thomas-rest-api-tls-short" in "thomas-helm-test"
    When I upgrade Helm Release "<TlsRestApiRelease>" with --install --atomic --create-namespace --set tls.enabled=true
    Then the command exited with 0

    Given Service "<TlsRestApiService>"
    And "<TlsRestApiService>" namespace is "thomas-helm-test"
    And "<TlsRestApiService>" label "app.kubernetes.io/instance" is "thomas-rest-api-tls-short"

    # Secret construction goes through the payload accumulator, not
    # progressive discovery - progressive discovery resolves through
    # discoverByFields directly, bypassing secretFromFields's bounded
    # retry for the real cert-manager async-issuance race this exact
    # scenario depends on; the payload accumulator instead flows through
    # secretFromFields itself, so the real retry is preserved (see
    # secret.ts).
    Given "<TlsRestApiSecretPayload>" field "namespace" is "thomas-helm-test"
    And "<TlsRestApiSecretPayload>" field "app.kubernetes.io/instance" is "thomas-rest-api-tls-short"
    Given Secret known as "<TlsRestApiSecret>" using "<TlsRestApiSecretPayload>"

    And HTTPS Endpoint "<TlsRestApi>" on "<TlsRestApiService>" port "8443" trusting "<TlsRestApiSecret>"
    When I send a GET request to Endpoint known as "<TlsRestApi>" path "/health/live"
    Then the response status is 200

    When I uninstall Helm Release known as "<TlsRestApiRelease>"
    Then the command exited with 0
    When I delete Secret known as "<TlsRestApiSecret>"
    Then the command exited with 0
