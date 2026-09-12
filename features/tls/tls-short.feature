Feature: BDD Framework for TLS generation (short syntax)
  As a platform engineer
  I want to generate a real self-signed CA and a real certificate it
  signs using the short oneline and `with <flags>` forms
  So that I can seed a fixture app's real TLS trust chain, reading the
  least amount of Gherkin necessary to do it

  Scenario: Generating a Self-Signed CA and a certificate it signs
    When I create Directory known as "<CaDirectory>" at ".cache/tls-short/ca"
    And I generate Self-Signed CA "<Ca>" in Directory known as "<CaDirectory>" with -days 2 -subj /CN=thomas-test-ca
    Then the command exited with 0
    Given File "<CaCert>" at ".cache/tls-short/ca/ca-cert.pem"

    When I create Directory known as "<CertDirectory>" at ".cache/tls-short/cert"
    And I generate TLS Certificate known as "<Cert>" in Directory known as "<CertDirectory>" signed by Self-Signed CA known as "<Ca>" with:
      | OPTION  | VALUE                                           |
      | -subj   | /CN=thomas-test-git-server                      |
      | -addext | subjectAltName=DNS:thomas-test-git-server.local |
    Then the command exited with 0 STDERR contains "Certificate request self-signature ok"
    Given File "<TlsCert>" at ".cache/tls-short/cert/tls-cert.pem"
