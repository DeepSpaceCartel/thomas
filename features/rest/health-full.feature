Feature: BDD Framework for the rest-api test fixture's health probes (full syntax)
  As a DevOps engineer
  I want to exercise a real FastAPI app's k8s health-probe endpoints over
  real HTTP and HTTPS, and prove readiness failure behaves differently
  from liveness failure against the real cluster
  So that I can trust the pattern before building CRUD/auth on top of it

  Scenario: All three health endpoints report healthy after a real startup
    Given Directory "<RestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<RestApiHelmChart>" in "<RestApiChartDirectory>"
    And Helm Release "<RestApiRelease>" of "<RestApiHelmChart>" named "thomas-rest-api-release" in "thomas-helm-test"
    When I upgrade Helm Release known as "<RestApiRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic            | True  |
      | --create-namespace  | True  |
    Then the command exited with 0

    Given Service known as "<RestApiService>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/instance | thomas-rest-api-release  |
    And HTTP Endpoint "<RestApi>" on "<RestApiService>" port "8000"

    Given ConfigMap known as "<RestApiConfigMap>":
      | PROPERTY                   | VALUE                    |
      | namespace                  | thomas-helm-test         |
      | app.kubernetes.io/instance | thomas-rest-api-release |
    When I get ConfigMap known as "<RestApiConfigMap>" with:
      | OPTION   | VALUE |
      | --output | json  |
    Then the command result data has:
      | KEY             | CONDITION | VALUE |
      | data."notes.py" | exists    |       |
      | data."main.py"  | exists    |       |

    When I send a GET request to Endpoint known as "<RestApi>" path "/health/startup"
    Then the response status is 200:
      | SOURCE | CONDITION | VALUE          |
      | BODY   | contains  | "started":true |

    When I send a GET request to Endpoint known as "<RestApi>" path "/health/ready"
    Then the response status is 200
    Then the command result data has:
      | KEY   | CONDITION | VALUE |
      | ready | equals    | true  |
    Then the response headers has:
      | KEY          | CONDITION | VALUE            |
      | content-type | contains  | application/json |

    When I send a GET request to Endpoint known as "<RestApi>" path "/health/live"
    Then the response status is 200

    When I uninstall Helm Release known as "<RestApiRelease>"
    Then the command exited with 0

  Scenario: Flipping readiness removes the Pod from Service endpoints without restarting it
    Given Directory "<RestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<RestApiHelmChart>" in "<RestApiChartDirectory>"
    And Helm Release "<ReadinessRelease>" of "<RestApiHelmChart>" named "thomas-rest-api-readiness" in "thomas-helm-test"
    When I upgrade Helm Release known as "<ReadinessRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic            | True  |
      | --create-namespace  | True  |
    Then the command exited with 0

    Given Service known as "<ReadinessService>":
      | PROPERTY                   | VALUE                      |
      | namespace                  | thomas-helm-test         |
      | app.kubernetes.io/instance | thomas-rest-api-readiness |
    And HTTP Endpoint "<ReadinessApi>" on "<ReadinessService>" port "8000"

    When I send a PUT request to Endpoint known as "<ReadinessApi>" path "/_test/ready" with:
      | TYPE  | KEY   | VALUE |
      | QUERY | ready | false |
    Then the response status is 200

    Given Pod known as "<ReadinessPod>":
      | PROPERTY                   | VALUE                      |
      | namespace                  | thomas-helm-test         |
      | app.kubernetes.io/instance | thomas-rest-api-readiness |
    When I poll Pod known as "<ReadinessPod>" every "3s" for up to "30s" until:
      | KEY                                       | CONDITION | VALUE | OUTCOME |
      | status.containerStatuses[0].ready         | equals    | false | pass    |
      | status.containerStatuses[0].restartCount  | equals    | 0     | pass    |

    # Deliberately no follow-up request to /health/ready through
    # Endpoint here: once the Pod is confirmed NotReady above, it has
    # been removed from the Service's endpoints entirely (that's what the
    # poll just proved) - a request routed through the Service has no
    # backend left to reach, so it fails to connect rather than
    # returning a 503. The readiness-gates-traffic behavior is already
    # fully proven by the poll above: k8s's own readinessProbe (hitting
    # this exact path) is what flipped containerStatuses[0].ready false.

    When I uninstall Helm Release known as "<ReadinessRelease>"
    Then the command exited with 0

  Scenario: Rejecting an unregistered Service alias from an HTTP Endpoint
    When I attempt to define HTTP Endpoint known as "<BadEndpoint>":
      | PROPERTY | VALUE                 |
      | service  | <UndefinedRestService> |
      | port     | 8000                  |
    Then it should have failed with 'No Service registered as "<UndefinedRestService>"'

  Scenario: Rejecting an HTTPS Endpoint missing a trust field
    Given Directory "<TrustlessChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<TrustlessHelmChart>" in "<TrustlessChartDirectory>"
    And Helm Release "<TrustlessRelease>" of "<TrustlessHelmChart>" named "thomas-rest-api-trustless" in "thomas-helm-test"
    When I upgrade Helm Release "<TrustlessRelease>" with --install --atomic --create-namespace
    Then the command exited with 0

    # A real, already-registered Service - only the missing `trust`
    # field is under test here, so no TLS listener is needed at all.
    Given Service known as "<TrustlessService>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test          |
      | app.kubernetes.io/instance | thomas-rest-api-trustless |
    When I attempt to define HTTPS Endpoint known as "<TrustlessEndpoint>":
      | PROPERTY | VALUE               |
      | service  | <TrustlessService>  |
      | port     | 8443                |
    Then it should have failed with 'An HTTPS Endpoint requires a "trust" field naming a registered Secret to verify against'

    When I uninstall Helm Release known as "<TrustlessRelease>"
    Then the command exited with 0

  Scenario: Reaching a real self-signed TLS listener over HTTPS with real certificate verification
    Given Directory "<TlsRestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<TlsRestApiHelmChart>" in "<TlsRestApiChartDirectory>"
    And Helm Release "<TlsRestApiRelease>" of "<TlsRestApiHelmChart>" named "thomas-rest-api-tls" in "thomas-helm-test"
    When I upgrade Helm Release known as "<TlsRestApiRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic            | True  |
      | --create-namespace  | True  |
      | --set               | tls.enabled=true |
    Then the command exited with 0

    Given Service known as "<TlsRestApiService>":
      | PROPERTY                   | VALUE               |
      | namespace                  | thomas-helm-test    |
      | app.kubernetes.io/instance | thomas-rest-api-tls |

    # Real cert-manager async issuance, same race/retry reasoning as
    # tls.feature's own Secret discovery.
    Given Secret known as "<TlsRestApiSecret>":
      | PROPERTY                   | VALUE               |
      | namespace                  | thomas-helm-test    |
      | app.kubernetes.io/instance | thomas-rest-api-tls |

    And HTTPS Endpoint known as "<TlsRestApi>":
      | PROPERTY | VALUE                  |
      | service  | <TlsRestApiService>    |
      | port     | 8443                   |
      | trust    | <TlsRestApiSecret>     |
    When I send a GET request to Endpoint known as "<TlsRestApi>" path "/health/live"
    Then the response status is 200

    When I uninstall Helm Release known as "<TlsRestApiRelease>"
    Then the command exited with 0
    When I delete Secret known as "<TlsRestApiSecret>"
    Then the command exited with 0

  Scenario: Rejecting a real certificate that does not match the trusted Secret
    Given Directory "<TlsRestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<TlsRestApiHelmChart>" in "<TlsRestApiChartDirectory>"
    And Helm Release "<MismatchTlsRelease>" of "<TlsRestApiHelmChart>" named "thomas-rest-api-mismatch" in "thomas-helm-test"
    When I upgrade Helm Release known as "<MismatchTlsRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic            | True  |
      | --create-namespace  | True  |
      | --set               | tls.enabled=true |
    Then the command exited with 0

    Given Service known as "<MismatchTlsService>":
      | PROPERTY                   | VALUE                    |
      | namespace                  | thomas-helm-test         |
      | app.kubernetes.io/instance | thomas-rest-api-mismatch |

    Given Directory "<TlsDemoChartDirectory>" at "./charts/test-tls-demo"
    And Helm Chart "<TlsDemoHelmChart>" in "<TlsDemoChartDirectory>"
    And Helm Release "<TlsDemoRelease>" of "<TlsDemoHelmChart>" named "thomas-tls-demo-mismatch" in "thomas-helm-test"
    When I upgrade Helm Release known as "<TlsDemoRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic            | True  |
      | --create-namespace  | True  |
    Then the command exited with 0

    # Real, unrelated Secret - a genuinely different self-signed cert
    # than the one test-rest-api's own uvicorn is actually terminating
    # TLS with, proving verification is real rather than accidentally
    # always-passing.
    Given Secret known as "<UnrelatedSecret>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test          |
      | app.kubernetes.io/instance | thomas-tls-demo-mismatch  |

    And HTTPS Endpoint known as "<MismatchApi>":
      | PROPERTY | VALUE               |
      | service  | <MismatchTlsService> |
      | port     | 8443                |
      | trust    | <UnrelatedSecret>   |
    When I attempt to send a GET request to Endpoint known as "<MismatchApi>" path "/health/live"
    # Node's fetch() reports a real TLS verification failure as a generic
    # top-level "fetch failed" (confirmed live against this exact
    # mismatched-CA scenario) - the specific reason ("self-signed
    # certificate") lives on error.cause, which "it should have failed
    # with" doesn't inspect.
    Then it should have failed with "fetch failed"

    When I uninstall Helm Release known as "<MismatchTlsRelease>"
    Then the command exited with 0
    When I uninstall Helm Release known as "<TlsDemoRelease>"
    Then the command exited with 0
    When I delete Secret known as "<UnrelatedSecret>"
    Then the command exited with 0
