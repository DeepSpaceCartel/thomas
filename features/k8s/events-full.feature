Feature: BDD Framework for structured Kubernetes Events (full table syntax)
  As a DevOps engineer
  I want to poll a Pod's real Events and assert on its Reason and
  Message as separate structured fields, not just a combined substring
  So that I can distinguish "which real condition happened" (Reason)
  from "the real detail of what happened" (Message) instead of hoping
  both show up adjacent to each other in raw text

  Scenario: Observing a real, transient startup-probe failure and recovery
    Given Directory known as "<RestApiChartDirectory>":
      | PROPERTY | VALUE                  |
      | path     | ./charts/test-rest-api |
    And Helm Chart known as "<RestApiHelmChart>":
      | PROPERTY | VALUE                     |
      | chart    | <RestApiChartDirectory>  |
    And Helm Release known as "<EventsRelease>":
      | PROPERTY  | VALUE                     |
      | chart     | <RestApiHelmChart>        |
      | name      | thomas-rest-api-events    |
      | namespace | thomas-helm-test          |
    # Deliberately no `--atomic` - the real, transient startup-probe
    # failure this scenario polls for only exists in the real window
    # before the app finishes its own real, uncached `pip install` and
    # starts answering `/health/startup`; `--atomic` would block until
    # past that window, same real technique kubernetes-full.feature's
    # "Failing fast when a Pod enters a bad state" scenario already uses
    # to observe an in-between state.
    When I upgrade Helm Release known as "<EventsRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --create-namespace | True  |
    Then the command exited with 0

    Given Pod known as "<EventsPod>":
      | PROPERTY                   | VALUE                  |
      | namespace                  | thomas-helm-test       |
      | app.kubernetes.io/instance | thomas-rest-api-events |

    # Confirmed live against this exact real fixture before writing this
    # scenario: `kubectl get events -o json` for a freshly-scheduled
    # test-rest-api Pod really does produce a Reason="Unhealthy" event
    # whose real Message is "Startup probe failed: ..." during the real
    # pip-install window - not a simulated/mocked event.
    When I poll structured events for Pod known as "<EventsPod>" every "3s" for up to "60s" until:
      | KEY              | CONDITION | VALUE                 | OUTCOME |
      | items[*].reason  | contains  | Unhealthy             | pass    |
      | items[*].message | contains  | Startup probe failed  | pass    |

    # The same real Pod genuinely recovers once `pip install` finishes -
    # confirmed live, well under this scenario's own timeout.
    When I poll Pod known as "<EventsPod>" every "3s" for up to "60s" until:
      | KEY          | CONDITION | VALUE   | OUTCOME |
      | status.phase | equals    | Running | pass    |

    When I uninstall Helm Release known as "<EventsRelease>"
    Then the command exited with 0
