Feature: BDD Framework for TLS generation (full table syntax)
  As a platform engineer
  I want to generate a real self-signed CA and a real certificate it
  signs using the full PROPERTY|VALUE / OPTION|VALUE table forms
  So that I can seed a fixture app's real TLS trust chain, with every
  field spelled out explicitly

  Scenario: Generating a Self-Signed CA and a certificate it signs
    # A captured value embedded in -subj/-addext - both generation tables
    # go through the same soft substitution every other domain's
    # construction table gets, so a real, dynamic hostname (e.g. a
    # namespace-dependent Service DNS name) can drive the CA's/cert's own
    # real fields, not just fixed literals.
    Given the value "thomas-test-ca" is known as "<CaCommonName>"
    When I create Directory known as "<CaDirectory>" at ".cache/tls-full/ca"
    And I generate Self-Signed CA known as "<Ca>" in Directory known as "<CaDirectory>" with:
      | OPTION | VALUE               |
      | -days  | 2                   |
      | -subj  | /CN=<CaCommonName> |
    Then the command exited with 0
    # Real proof the CA material was really written to disk.
    Given File known as "<CaCert>":
      | PROPERTY | VALUE                           |
      | path     | .cache/tls-full/ca/ca-cert.pem  |

    Given the value "thomas-test-git-server.local" is known as "<CertSan>"
    When I create Directory known as "<CertDirectory>" at ".cache/tls-full/cert"
    And I generate TLS Certificate known as "<Cert>" in Directory known as "<CertDirectory>" signed by Self-Signed CA known as "<Ca>" with:
      | OPTION  | VALUE                         |
      | -subj   | /CN=thomas-test-git-server    |
      | -addext | subjectAltName=DNS:<CertSan> |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                  |
      | STDERR | contains  | Certificate request self-signature ok |
    # Real proof the signed cert was really written to disk, AND that the
    # captured value was really substituted into the SAN before openssl
    # ever saw it (a literal, un-substituted "<CertSan>" contains "<"/">"
    # characters openssl's own subjectAltName parser rejects outright,
    # confirmed live - so 0m00.0s exit-0 success here already proves
    # substitution happened, not just that the command didn't crash).
    Given File known as "<TlsCert>":
      | PROPERTY | VALUE                              |
      | path     | .cache/tls-full/cert/tls-cert.pem  |
