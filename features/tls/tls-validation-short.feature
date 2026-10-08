Feature: TLS (Self-Signed CA / TLS Certificate) validation (short syntax)

  Scenario: Defining a Self-Signed CA
    Given Directory "<CaDirectory>" at "./fixtures/ssh"
    And Self-Signed CA "<Ca>" in "<CaDirectory>"

  Scenario: Rejecting an unknown property on Self-Signed CA
    Given "<BadCaPayload>" field "xxx" is "yyy"
    When I attempt to define Self-Signed CA known as "<BadCa>" using "<BadCaPayload>"
    Then it should have failed with 'SelfSignedCa has no field "xxx"'

  Scenario: Rejecting a nonexistent directory on Self-Signed CA
    Given "<MissingCaPayload>" field "directory" is "./does-not-exist"
    When I attempt to define Self-Signed CA known as "<MissingCa>" using "<MissingCaPayload>"
    Then it should have failed with 'SelfSignedCa directory does not exist'

  Scenario: Defining a TLS Certificate
    Given Directory "<CertDirectory>" at "./fixtures/ssh"
    And TLS Certificate "<Cert>" in "<CertDirectory>"

  Scenario: Rejecting an unknown property on TLS Certificate
    Given "<BadCertPayload>" field "xxx" is "yyy"
    When I attempt to define TLS Certificate known as "<BadCert>" using "<BadCertPayload>"
    Then it should have failed with 'TlsCertificate has no field "xxx"'

  Scenario: Rejecting a nonexistent directory on TLS Certificate
    Given "<MissingCertPayload>" field "directory" is "./does-not-exist"
    When I attempt to define TLS Certificate known as "<MissingCert>" using "<MissingCertPayload>"
    Then it should have failed with 'TlsCertificate directory does not exist'
