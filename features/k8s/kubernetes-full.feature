Feature: BDD Framework for real k8s resources created by a Helm Release (full table syntax)
  As a DevOps engineer
  I want to discover the real Deployment/Service/Pod a HelmRelease creates,
  by their real labels, inspect their real cluster state, and poll for
  eventually-consistent readiness with real fast-fail on a bad state,
  using the full PROPERTY|VALUE / OPTION|VALUE table forms
  So that I can verify a chart's actual runtime behavior, not just that
  `helm install` exited zero, with every field spelled out explicitly

  Scenario: Discovering and validating a HelmRelease's Deployment, Service, and Pod
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<NginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    And Helm Release known as "<NginxRelease>":
      | PROPERTY  | VALUE                     |
      | chart     | <NginxHelmChart>          |
      | name      | thomas-nginx-k8s-release  |
      | namespace | thomas-helm-test          |
    When I upgrade Helm Release known as "<NginxRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic           | True  |
      | --create-namespace | True  |
    Then the command exited with 0

    Given Deployment known as "<NginxDeployment>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/name     | test-nginx                |
      | app.kubernetes.io/instance | thomas-nginx-k8s-release |
    And Service known as "<NginxService>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/name     | test-nginx                |
      | app.kubernetes.io/instance | thomas-nginx-k8s-release |

    When I get Deployment known as "<NginxDeployment>" with:
      | OPTION   | VALUE |
      | --output | json  |
    Then the command result data has:
      | KEY                                          | CONDITION | VALUE |
      | status.readyReplicas                         | equals    | 1     |
      | status.readyReplicas                         | gte       | 1     |
      | status.availableReplicas                     | equals    | 1     |
      | spec.replicas                                | equals    | 1     |
      | spec.replicas                                | gt        | 0     |
      | metadata.labels."app.kubernetes.io/version"   | equals    | 1.27  |

    When I get Service known as "<NginxService>" with:
      | OPTION   | VALUE |
      | --output | json  |
    Then the command result data has:
      | KEY                                          | CONDITION | VALUE      |
      | spec.ports[0].port                           | equals    | 80         |
      | spec.type                                    | equals    | ClusterIP  |
      | metadata.labels."app.kubernetes.io/version"   | equals    | 1.27       |

    # Safe here specifically because this release is installed once and
    # never upgraded/rolled back again in this scenario - see
    # support/k8s/replicaset.ts's header comment for why a ReplicaSet
    # lookup breaks against a release with more than one revision.
    Given ReplicaSet known as "<NginxReplicaSet>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/name     | test-nginx                |
      | app.kubernetes.io/instance | thomas-nginx-k8s-release |
    When I get ReplicaSet known as "<NginxReplicaSet>" with:
      | OPTION   | VALUE |
      | --output | json  |
    Then the command result data has:
      | KEY             | CONDITION | VALUE |
      | status.replicas | equals    | 1     |

    When I get events for Deployment known as "<NginxDeployment>" with:
      | OPTION       | VALUE |
      | --show-kind  | True  |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                 |
      | STDOUT | contains  | Scaled up replica set |
    # No flags to pass at all here - the bare table-less form, same in
    # both this file and kubernetes-short.feature (nothing to shorten).
    When I get events for Deployment known as "<NginxDeployment>"
    Then the command exited with 0

    When I get logs for Deployment known as "<NginxDeployment>" with:
      | OPTION        | VALUE |
      | --timestamps  | True  |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                      |
      | STDOUT | contains  | Configuration complete; ready for start up |
    When I get logs for Deployment known as "<NginxDeployment>"
    Then the command exited with 0

    # A Pod, unlike Deployment/Service, has no such guarantee of already
    # being stable - so its readiness is polled, not checked once.
    Given Pod known as "<NginxPod>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test        |
      | app.kubernetes.io/name     | test-nginx                |
      | app.kubernetes.io/instance | thomas-nginx-k8s-release |

    When I poll Pod known as "<NginxPod>" every "3s" for up to "30s" until:
      | KEY                                               | CONDITION | VALUE            | OUTCOME |
      | status.phase                                      | equals    | Running          | pass    |
      | status.containerStatuses[0].ready                 | equals    | true              | pass    |
      | status.containerStatuses[0].restartCount           | equals    | 0                 | pass    |
      | status.containerStatuses[0].state.waiting.reason   | equals    | CrashLoopBackOff  | fail    |

    When I poll logs for Pod known as "<NginxPod>" every "3s" for up to "15s" until:
      | SOURCE | CONDITION | VALUE                                       | OUTCOME |
      | STDOUT | contains  | Configuration complete; ready for start up | pass    |

    When I poll events for Pod known as "<NginxPod>" every "3s" for up to "15s" until:
      | SOURCE | CONDITION | VALUE   | OUTCOME |
      | STDOUT | contains  | Started | pass    |
      | STDOUT | contains  | BackOff | fail    |

    # Reaching inside the Pod for a real check `get`/`logs`/`events` can't
    # answer from the outside - the real, actually-rendered config file.
    When I exec "cat /etc/nginx/conf.d/default.conf" in Pod known as "<NginxPod>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE        |
      | STDOUT | contains  | location / { |

    # RBAC: this Pod's real ServiceAccount (the chart declares none, so
    # it's the namespace's `default`) genuinely cannot create Deployments
    # in a cluster with standard RBAC - a different axis from
    # get/logs/events entirely (permissions, not state).
    When I check if Pod known as "<NginxPod>" can "create" "deployments"
    Then the command exited with 1

    When I uninstall Helm Release known as "<NginxRelease>"
    Then the command exited with 0

  Scenario: Rejecting a label selector that matches no real resource
    When I attempt to define Deployment known as "<UnmatchedDeployment>":
      | PROPERTY                   | VALUE                              |
      | namespace                  | thomas-helm-test                  |
      | app.kubernetes.io/instance | no-such-release-should-ever-exist |
    Then it should have failed with "Expected exactly one deployment matching"

  Scenario: Failing fast when a Pod enters a bad state
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<NginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    And Helm Release known as "<BadImageRelease>":
      | PROPERTY  | VALUE                            |
      | chart     | <NginxHelmChart>                 |
      | name      | thomas-nginx-badimage-release    |
      | namespace | thomas-helm-test                 |
    # Deliberately no `--atomic` here - that would block and eventually
    # roll back on its own, which is exactly the condition this scenario
    # needs to observe directly via polling instead.
    When I upgrade Helm Release known as "<BadImageRelease>" with:
      | OPTION             | VALUE                               |
      | --install          | True                                |
      | --create-namespace | True                                |
      | --set              | image.repository=no-such-image-xyz |
      | --set              | image.tag=bogus                     |
    Then the command exited with 0

    Given Pod known as "<BadImagePod>":
      | PROPERTY                   | VALUE                          |
      | namespace                  | thomas-helm-test               |
      | app.kubernetes.io/instance | thomas-nginx-badimage-release |
    When I attempt to poll Pod known as "<BadImagePod>" every "3s" for up to "2m" until:
      | KEY                                              | CONDITION | VALUE            | OUTCOME |
      | status.phase                                     | equals    | Running          | pass    |
      | status.containerStatuses[0].state.waiting.reason | equals    | ErrImagePull     | fail    |
      | status.containerStatuses[0].state.waiting.reason | equals    | ImagePullBackOff | fail    |
    Then it should have failed with either:
      | MESSAGE          |
      | ErrImagePull     |
      | ImagePullBackOff |

    When I uninstall Helm Release known as "<BadImageRelease>"
    Then the command exited with 0

  Scenario: A poll that never observes its condition genuinely times out
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<NginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    And Helm Release known as "<PollTimeoutRelease>":
      | PROPERTY  | VALUE                          |
      | chart     | <NginxHelmChart>               |
      | name      | thomas-nginx-poll-timeout      |
      | namespace | thomas-helm-test               |
    When I upgrade Helm Release known as "<PollTimeoutRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic           | True  |
      | --create-namespace | True  |
    Then the command exited with 0

    Given Pod known as "<PollTimeoutPod>":
      | PROPERTY                   | VALUE                     |
      | namespace                  | thomas-helm-test          |
      | app.kubernetes.io/instance | thomas-nginx-poll-timeout |
    # No `fail` row at all - a real, running Pod never reaches this phase
    # on its own, so the poll can only ever run out its own real clock,
    # not short-circuit on an early failure condition (that path is
    # already covered above by "Failing fast when a Pod enters a bad
    # state"). This is real elapsed wall-clock time, not simulated -
    # kept short (a couple of real poll intervals) on purpose.
    When I attempt to poll Pod known as "<PollTimeoutPod>" every "2s" for up to "6s" until:
      | KEY           | CONDITION | VALUE                     | OUTCOME |
      | status.phase  | equals    | SomeStateThatNeverHappens | pass    |
    Then it should have failed with "Poll timed out after"

    When I uninstall Helm Release known as "<PollTimeoutRelease>"
    Then the command exited with 0
