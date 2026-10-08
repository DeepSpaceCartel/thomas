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

    # Real proof a Service field can be captured for later use, not just
    # asserted on - the motivating real need is a Service's real
    # ClusterIP, since a *.svc.cluster.local name only resolves from
    # inside a pod's own network namespace (CoreDNS), never from the node
    # itself - kubelet's own image pulls need the real IP instead. If
    # capture failed, composing a new value from it below would throw
    # "No captured value known as ..." - a successful chain is the proof.
    Given the value at "spec.clusterIP" from the command result is known as "<NginxClusterIp>"
    Given the value "http://<NginxClusterIp>:80" is known as "<NginxClusterIpUrl>"

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

  Scenario: Discovering a real resource using a namespace built from a captured environment variable
    # A real two-level fallback (${VAR1:-${VAR2:-DEFAULT}}) - USER is
    # real in this process's own environment, so this exercises the
    # fallback path for real, not just the primary one.
    Given the value of environment variable "THOMAS_DOES_NOT_EXIST", or "USER", or "nobody" is known as "<Owner>"
    And the value "thomas-helm-test" is known as "<CapturedNamespace>"

    Given Directory known as "<CapturedNsChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<CapturedNsHelmChart>":
      | PROPERTY | VALUE                       |
      | chart    | <CapturedNsChartDirectory> |
    And Helm Release known as "<CapturedNsRelease>":
      | PROPERTY  | VALUE                    |
      | chart     | <CapturedNsHelmChart>    |
      | name      | thomas-captured-ns-release |
      | namespace | <CapturedNamespace>      |
    When I upgrade Helm Release known as "<CapturedNsRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --atomic           | True  |
      | --create-namespace | True  |
    Then the command exited with 0

    # The real proof: a Deployment discovered using the *same* captured
    # namespace value, substituted into a plain PROPERTY|VALUE table cell
    # (not a resolveResource-style <Alias>) - if substitution didn't
    # really happen, this would search literally for a namespace named
    # "<CapturedNamespace>" and fail to find anything.
    Given Deployment known as "<CapturedNsDeployment>":
      | PROPERTY                   | VALUE                      |
      | namespace                  | <CapturedNamespace>        |
      | app.kubernetes.io/instance | thomas-captured-ns-release |
    When I get Deployment known as "<CapturedNsDeployment>" with:
      | OPTION   | VALUE |
      | --output | json  |
    Then the command exited with 0

    When I uninstall Helm Release known as "<CapturedNsRelease>"
    Then the command exited with 0

  Scenario: Labeling a real namespace
    When I label namespace "thomas-helm-test" with:
      | OPTION      | VALUE                   |
      |             | thomas.test/label=probe |
      | --overwrite | True                    |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE   |
      | STDOUT | contains  | labeled |

    # Real cleanup - a trailing "-" on a kubectl label key removes it.
    When I label namespace "thomas-helm-test" with --overwrite thomas.test/label-
    Then the command exited with 0

  Scenario: Creating a ConfigMap from a real file, unowned by any Helm release
    When I create File known as "<CaCertFile>" at ".cache/configmap-from-file-scratch/ca-cert.pem" with:
      """
      -----BEGIN CERTIFICATE-----
      not-a-real-cert-just-real-file-content
      -----END CERTIFICATE-----
      """
    When I create ConfigMap known as "<CaCertConfigMap>" named "thomas-ca-cert-probe" in "thomas-helm-test" from file "ca-cert.pem" at ".cache/configmap-from-file-scratch/ca-cert.pem"
    Then the command exited with 0

    When I get ConfigMap "<CaCertConfigMap>" as JSON
    Then the command result data has:
      | KEY                     | CONDITION | VALUE                                    |
      | data."ca-cert.pem"      | contains  | not-a-real-cert-just-real-file-content   |

    # No ownerReference to any Helm release (unlike every other ConfigMap
    # this suite touches) - `I delete` is the real cleanup, not `helm
    # uninstall`.
    When I delete ConfigMap known as "<CaCertConfigMap>"
    Then the command exited with 0

  Scenario: Creating a Secret from a real file, unowned by any Helm release
    When I create File known as "<BadCredsFile>" at ".cache/secret-from-file-scratch/git-creds.json" with:
      """
      { this is not valid JSON
      """
    When I create Secret known as "<BadCredsSecret>" named "thomas-bad-creds-probe" in "thomas-helm-test" from file "git-creds.json" at ".cache/secret-from-file-scratch/git-creds.json"
    Then the command exited with 0

    When I get Secret "<BadCredsSecret>" as JSON
    Then the command result has "data.\"git-creds.json\"" exists

    # No ownerReference to any Helm release - `I delete` is the real
    # cleanup, not `helm uninstall`.
    When I delete Secret known as "<BadCredsSecret>"
    Then the command exited with 0

  # A worker-scoped fixture path (the real motivating case: cucumber-js's
  # own CUCUMBER_WORKER_ID under --parallel) composes the same captured
  # path segment into the File write above and the ConfigMap-from-file
  # read below - proves both `filePath` arguments get soft-substituted,
  # not just the File-creation path already covered in file-full.feature.
  Scenario: Creating a ConfigMap from a real file at a path built from a captured value
    Given the value "configmap-from-captured-path" is known as "<CapturedSuffix>"
    When I create File known as "<CapturedPathFile>" at ".cache/configmap-from-file-scratch/<CapturedSuffix>.pem" with:
      """
      -----BEGIN CERTIFICATE-----
      also-real-file-content-not-a-real-cert
      -----END CERTIFICATE-----
      """
    When I create ConfigMap known as "<CapturedPathConfigMap>" named "thomas-captured-path-probe" in "thomas-helm-test" from file "ca-cert.pem" at ".cache/configmap-from-file-scratch/<CapturedSuffix>.pem"
    Then the command exited with 0

    When I get ConfigMap "<CapturedPathConfigMap>" as JSON
    Then the command result data has:
      | KEY                | CONDITION | VALUE                              |
      | data."ca-cert.pem" | contains  | also-real-file-content-not-a-real-cert |

    When I delete ConfigMap known as "<CapturedPathConfigMap>"
    Then the command exited with 0

  Scenario: Rejecting a label selector that matches no real resource
    When I attempt to define Deployment known as "<UnmatchedDeployment>":
      | PROPERTY                   | VALUE                              |
      | namespace                  | thomas-helm-test                  |
      | app.kubernetes.io/instance | no-such-release-should-ever-exist |
    Then it should have failed with "Expected exactly one deployment matching"

  Scenario: Waiting for a fire-and-forget rollout's Pod to become discoverable
    Given Directory known as "<FireAndForgetChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<FireAndForgetHelmChart>":
      | PROPERTY | VALUE                        |
      | chart    | <FireAndForgetChartDirectory> |
    And Helm Release known as "<FireAndForgetRelease>":
      | PROPERTY  | VALUE                   |
      | chart     | <FireAndForgetHelmChart> |
      | name      | thomas-fire-and-forget  |
      | namespace | thomas-helm-test        |
    # No --atomic/--wait - dispatches and returns immediately, the same
    # real fire-and-forget shape a deliberately-never-Ready rollout uses.
    When I upgrade Helm Release known as "<FireAndForgetRelease>" with:
      | OPTION             | VALUE |
      | --install          | True  |
      | --create-namespace | True  |
    Then the command exited with 0

    Given Pod "<FireAndForgetPod>"
    And "<FireAndForgetPod>" namespace is "thomas-helm-test"
    And "<FireAndForgetPod>" label "app.kubernetes.io/instance" is "thomas-fire-and-forget"
    # The real proof: this Pod is not guaranteed to exist yet the instant
    # `helm upgrade` returns - a bare `Given Pod known as "<Alias>":` here
    # would race it for real. This retries real discovery itself (not a
    # field of an already-known object) until it succeeds.
    When I wait for Pod known as "<FireAndForgetPod>" every "1s" for up to "30s"
    When I get Pod known as "<FireAndForgetPod>" with:
      | OPTION   | VALUE |
      | --output | json  |
    Then the command exited with 0

    When I uninstall Helm Release known as "<FireAndForgetRelease>"
    Then the command exited with 0

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
