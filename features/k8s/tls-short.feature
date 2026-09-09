Feature: BDD Framework for real cert-manager certificates (short syntax)
  As a DevOps engineer
  I want to discover a real Kubernetes TLS Secret cert-manager issued and
  inspect the real certificate it contains
  So that I can verify a chart's TLS setup actually produced a real,
  correctly-configured certificate, not just that the Certificate
  resource was accepted

  Scenario: Issuing a self-signed certificate and inspecting it
    Given Directory "<TlsDemoChartDirectory>" at "./charts/test-tls-demo"
    And Helm Chart "<TlsDemoHelmChart>" in "<TlsDemoChartDirectory>"
    And Helm Release "<TlsDemoRelease>" of "<TlsDemoHelmChart>" named "thomas-tls-demo-release" in "thomas-helm-test"
    When I upgrade Helm Release "<TlsDemoRelease>" with --install --atomic --create-namespace
    Then the command exited with 0

    # `--atomic` only waits on kinds Helm itself knows how to check
    # rollout status for (Deployment/StatefulSet/etc.) - a cert-manager
    # `Certificate` isn't one of them. Real, verified issuance with the
    # `selfSigned` issuer is fast (well under a second once cert-manager's
    # controller picks it up), but "picks it up" is still a real race
    # against this step - confirmed for real when an early run of this
    # scenario hit "found 0" here. `Given Secret known as ... using ...`
    # retries discovery for a few real seconds before giving up (see
    # `secretFromFields`) specifically to cover that gap - the payload
    # accumulator below still goes through that exact same real retry,
    # not a bypass of it (see secret.ts).
    Given "<TlsDemoSecretPayload>" field "namespace" is "thomas-helm-test"
    And "<TlsDemoSecretPayload>" field "app.kubernetes.io/instance" is "thomas-tls-demo-release"
    Given Secret known as "<TlsDemoSecret>" using "<TlsDemoSecretPayload>"
    When I inspect the certificate in Secret known as "<TlsDemoSecret>"
    Then the command exited with 0 STDOUT contains CN=demo.thomas-helm-test.local
    Then the command exited with 0 STDOUT contains DNS:demo.thomas-helm-test.local

    # `helm uninstall` only removes what Helm itself templated
    # (Issuer/Certificate) - cert-manager's own Secret has no
    # ownerReference back to either, so it's a real, confirmed orphan
    # unless deleted explicitly (verified for real while building this
    # scenario: it was still present, unchanged, well after uninstall).
    When I uninstall Helm Release known as "<TlsDemoRelease>"
    Then the command exited with 0
    When I delete Secret known as "<TlsDemoSecret>"
    Then the command exited with 0
