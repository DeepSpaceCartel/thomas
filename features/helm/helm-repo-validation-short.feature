Feature: Helm Repo validation (short syntax)

  Scenario: Defining a Helm Repo
    Given URL "<BitnamiRepoUrl>" at "https://charts.bitnami.com/bitnami"
    And Helm Repo "<BitnamiHelmRepo>" named "bitnami" at "<BitnamiRepoUrl>"

  Scenario: Rejecting an unknown property
    Given "<BadRepoPayload>" field "xxx" is "yyy"
    When I attempt to define Helm Repo known as "<BadRepo>" using "<BadRepoPayload>"
    Then it should have failed with 'HelmRepo has no field "xxx"'

  Scenario: Rejecting a missing name
    Given "<NoNameRepoPayload>" field "url" is "https://charts.bitnami.com/bitnami"
    When I attempt to define Helm Repo known as "<NoNameRepo>" using "<NoNameRepoPayload>"
    Then it should have failed with 'HelmRepo requires a "name" field'

  Scenario: Rejecting a missing url
    Given "<NoUrlRepoPayload>" field "name" is "bitnami"
    When I attempt to define Helm Repo known as "<NoUrlRepo>" using "<NoUrlRepoPayload>"
    Then it should have failed with 'HelmRepo requires a "url" field'

  Scenario: Referencing an unregistered URL resource from a Helm Repo
    Given "<BadRepo2Payload>" field "name" is "bitnami"
    And "<BadRepo2Payload>" field "url" is "<UndefinedUrl>"
    When I attempt to define Helm Repo known as "<BadRepo>" using "<BadRepo2Payload>"
    Then it should have failed with 'No Resource registered as "<UndefinedUrl>"'
