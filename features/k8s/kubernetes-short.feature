Feature: BDD Framework for real k8s resources created by a Helm Release (short syntax)
  As a DevOps engineer
  I want to discover the real Deployment/Service/Pod a HelmRelease creates,
  by their real labels, inspect their real cluster state, and poll for
  eventually-consistent readiness with real fast-fail on a bad state,
  using the short oneline and `with <flags>` forms wherever one exists
  So that I can verify a chart's actual runtime behavior, not just that
  `helm install` exited zero, reading the least amount of Gherkin
  necessary to do it

  Scenario: Discovering and validating a HelmRelease's Deployment, Service, and Pod
    Given Directory "<NginxChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<NginxHelmChart>" in "<NginxChartDirectory>"
    And Helm Release "<NginxRelease>" of "<NginxHelmChart>" named "thomas-nginx-k8s-release" in "thomas-helm-test"
    When I upgrade Helm Release "<NginxRelease>" with --install --atomic --create-namespace
    Then the command exited with 0

    # Deployment/Service/ReplicaSet/Pod discovery is a real, read-only
    # `kubectl get` against an open-ended label selector - there's no
    # *fixed-arity* oneline form (see extending.md), but progressive
    # discovery is a real, existing short form for it: the same real,
    # one-time kubectl get, just spread over several Given/And lines and
    # resolved lazily on first use instead of eagerly from one table.
    # kubernetes-full.feature keeps the table form throughout by design.
    Given Deployment "<NginxDeployment>"
    And "<NginxDeployment>" namespace is "thomas-helm-test"
    And "<NginxDeployment>" label "app.kubernetes.io/name" is "test-nginx"
    And "<NginxDeployment>" label "app.kubernetes.io/instance" is "thomas-nginx-k8s-release"
    Given Service "<NginxService>"
    And "<NginxService>" namespace is "thomas-helm-test"
    And "<NginxService>" label "app.kubernetes.io/name" is "test-nginx"
    And "<NginxService>" label "app.kubernetes.io/instance" is "thomas-nginx-k8s-release"

    When I get Deployment "<NginxDeployment>" as JSON
    Then the command result has "status.readyReplicas" >= 1
    Then the command result has "status.availableReplicas" is 1
    Then the command result has "spec.replicas" is 1
    Then the command result has "spec.replicas" > 0
    Then the command result has "metadata.labels.\"app.kubernetes.io/version\"" is 1.27

    When I get Service "<NginxService>" as JSON
    Then the command result has "spec.ports[0].port" is 80
    Then the command result has "spec.type" is ClusterIP
    Then the command result has "metadata.labels.\"app.kubernetes.io/version\"" is 1.27

    # Safe here specifically because this release is installed once and
    # never upgraded/rolled back again in this scenario - see
    # support/k8s/replicaset.ts's header comment for why a ReplicaSet
    # lookup breaks against a release with more than one revision.
    Given ReplicaSet "<NginxReplicaSet>"
    And "<NginxReplicaSet>" namespace is "thomas-helm-test"
    And "<NginxReplicaSet>" label "app.kubernetes.io/name" is "test-nginx"
    And "<NginxReplicaSet>" label "app.kubernetes.io/instance" is "thomas-nginx-k8s-release"
    When I get ReplicaSet "<NginxReplicaSet>" as JSON
    Then the command result has "status.replicas" is 1

    When I get events for Deployment "<NginxDeployment>" with --show-kind
    Then the command exited with 0 STDOUT contains "Scaled up replica set"
    # No flags to pass at all here - the bare table-less form, same in
    # both this file and kubernetes-full.feature (nothing to shorten).
    When I get events for Deployment known as "<NginxDeployment>"
    Then the command exited with 0

    When I get logs for Deployment "<NginxDeployment>" with --timestamps
    Then the command exited with 0 STDOUT contains "Configuration complete; ready for start up"
    When I get logs for Deployment known as "<NginxDeployment>"
    Then the command exited with 0

    # A Pod, unlike Deployment/Service, has no such guarantee of already
    # being stable - so its readiness is polled, not checked once. Polling
    # itself has no oneline form (see extending.md) - that table stays as
    # a table here and in kubernetes-full.feature; only this Pod's own
    # discovery uses progressive discovery.
    Given Pod "<NginxPod>"
    And "<NginxPod>" namespace is "thomas-helm-test"
    And "<NginxPod>" label "app.kubernetes.io/name" is "test-nginx"
    And "<NginxPod>" label "app.kubernetes.io/instance" is "thomas-nginx-k8s-release"

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
    # `exec`/the RBAC check below take a single real string, not an
    # OPTION|VALUE table - nothing to shorten here either.
    When I exec "cat /etc/nginx/conf.d/default.conf" in Pod known as "<NginxPod>"
    Then the command exited with 0 STDOUT contains "location / {"

    # RBAC: this Pod's real ServiceAccount (the chart declares none, so
    # it's the namespace's `default`) genuinely cannot create Deployments
    # in a cluster with standard RBAC - a different axis from
    # get/logs/events entirely (permissions, not state).
    When I check if Pod known as "<NginxPod>" can "create" "deployments"
    Then the command exited with 1

    When I uninstall Helm Release known as "<NginxRelease>"
    Then the command exited with 0

  Scenario: Discovering a real resource using a namespace built from a captured environment variable
    Given the value of environment variable "THOMAS_DOES_NOT_EXIST", or "USER", or "nobody" is known as "<Owner>"
    And the value "thomas-helm-test" is known as "<CapturedNamespace>"

    Given Directory "<CapturedNsChartDirectory>" at "./charts/test-nginx"
    And Helm Chart "<CapturedNsHelmChart>" in "<CapturedNsChartDirectory>"
    And Helm Release "<CapturedNsRelease>" of "<CapturedNsHelmChart>" named "thomas-captured-ns-release-short" in "<CapturedNamespace>"
    When I upgrade Helm Release "<CapturedNsRelease>" with --install --atomic --create-namespace
    Then the command exited with 0

    Given Deployment "<CapturedNsDeployment>"
    And "<CapturedNsDeployment>" namespace is "<CapturedNamespace>"
    And "<CapturedNsDeployment>" label "app.kubernetes.io/instance" is "thomas-captured-ns-release-short"
    When I get Deployment "<CapturedNsDeployment>" as JSON
    Then the command exited with 0

    When I uninstall Helm Release known as "<CapturedNsRelease>"
    Then the command exited with 0

  Scenario: Capturing an environment variable with a single fallback default
    Given the value of environment variable "THOMAS_DOES_NOT_EXIST" or "fallback-value" is known as "<SingleFallbackValue>"
    Then the value known as "<SingleFallbackValue>" equals "fallback-value"

  Scenario: Labeling a real namespace
    When I label namespace "thomas-helm-test" with --overwrite thomas.test/label-short=probe
    Then the command exited with 0 STDOUT contains labeled

    When I label namespace "thomas-helm-test" with --overwrite thomas.test/label-short-
    Then the command exited with 0
