Feature: TLS (Self-Signed CA / TLS Certificate) validation (full syntax)

  Scenario: Defining a Self-Signed CA
    Given Directory "<CaDirectory>" at "./fixtures/ssh"
    And Self-Signed CA known as "<Ca>":
      | PROPERTY | VALUE          |
      | directory | <CaDirectory> |

  Scenario: Rejecting an unknown property on Self-Signed CA
    When I attempt to define Self-Signed CA known as "<BadCa>":
      | PROPERTY | VALUE |
      | xxx      | yyy   |
    Then it should have failed with 'SelfSignedCa has no field "xxx"'

  Scenario: Rejecting a nonexistent directory on Self-Signed CA
    When I attempt to define Self-Signed CA known as "<MissingCa>":
      | PROPERTY  | VALUE            |
      | directory | ./does-not-exist |
    Then it should have failed with 'SelfSignedCa directory does not exist'

  Scenario: Defining a TLS Certificate
    Given Directory "<CertDirectory>" at "./fixtures/ssh"
    And TLS Certificate known as "<Cert>":
      | PROPERTY  | VALUE           |
      | directory | <CertDirectory> |

  Scenario: Rejecting an unknown property on TLS Certificate
    When I attempt to define TLS Certificate known as "<BadCert>":
      | PROPERTY | VALUE |
      | xxx      | yyy   |
    Then it should have failed with 'TlsCertificate has no field "xxx"'

  Scenario: Rejecting a nonexistent directory on TLS Certificate
    When I attempt to define TLS Certificate known as "<MissingCert>":
      | PROPERTY  | VALUE            |
      | directory | ./does-not-exist |
    Then it should have failed with 'TlsCertificate directory does not exist'
