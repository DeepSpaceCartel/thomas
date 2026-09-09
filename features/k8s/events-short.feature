Feature: BDD Framework for structured Kubernetes Events (short syntax)
  As a DevOps engineer
  I want to poll a Pod's real Events and assert on its Reason and
  Message as separate structured fields, not just a combined substring
  So that I can distinguish "which real condition happened" (Reason)
  from "the real detail of what happened" (Message) instead of hoping
  both show up adjacent to each other in raw text

  Scenario: Observing a real, transient startup-probe failure and recovery
    Given Directory "<RestApiChartDirectory>" at "./charts/test-rest-api"
    And Helm Chart "<RestApiHelmChart>" in "<RestApiChartDirectory>"
    # A distinct release name from events-full.feature's own
    # "thomas-rest-api-events" - confirmed for real that sharing one
    # races a non-atomic install's Pod against the previous scenario's
    # still-terminating one, genuinely matching 2 real Pods on the same
    # label selector.
    And Helm Release "<EventsRelease>" of "<RestApiHelmChart>" named "thomas-rest-api-events-short" in "thomas-helm-test"
    # Deliberately no `--atomic` - the real, transient startup-probe
    # failure this scenario polls for only exists in the real window
    # before the app finishes its own real, uncached `pip install` and
    # starts answering `/health/startup`.
    When I upgrade Helm Release "<EventsRelease>" with --install --create-namespace
    Then the command exited with 0

    Given Pod "<EventsPod>"
    And "<EventsPod>" namespace is "thomas-helm-test"
    And "<EventsPod>" label "app.kubernetes.io/instance" is "thomas-rest-api-events-short"

    # Confirmed live against this exact real fixture before writing this
    # scenario: `kubectl get events -o json` for a freshly-scheduled
    # test-rest-api Pod really does produce a Reason="Unhealthy" event
    # whose real Message is "Startup probe failed: ..." during the real
    # pip-install window - not a simulated/mocked event. Polling itself
    # has no oneline form (2+ conditions always) - stays a table here
    # and in events-full.feature.
    When I poll structured events for Pod known as "<EventsPod>" every "3s" for up to "60s" until:
      | KEY              | CONDITION | VALUE                 | OUTCOME |
      | items[*].reason  | contains  | Unhealthy             | pass    |
      | items[*].message | contains  | Startup probe failed  | pass    |

    When I poll Pod known as "<EventsPod>" every "3s" for up to "60s" until:
      | KEY          | CONDITION | VALUE   | OUTCOME |
      | status.phase | equals    | Running | pass    |

    When I uninstall Helm Release known as "<EventsRelease>"
    Then the command exited with 0
