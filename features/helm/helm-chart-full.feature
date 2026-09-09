Feature: BDD Framework for Helm Charts (full table syntax)
  As a DevOps engineer
  I want to deploy Helm charts and verify their status using the full
  PROPERTY|VALUE / OPTION|VALUE table forms
  So that I can ensure my deployments are successful and meet the required
  conditions, with every field spelled out explicitly

  Scenario: Defining Local Helm Chart
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    And Helm Chart known as "<LocalNginxHelmChart>" has:
      | KEY         | CONDITION | VALUE       |
      | apiVersion  | equals    | v2          |
      | name        | equals    | test-nginx  |
      | description | contains  | nginx       |
      | type        | equals    | application |
      | version     | equals    | 0.1.0       |
      | appVersion  | equals    | 1.27        |

  Scenario: Defining Local Archive Chart
    Given File known as "<NginxChartFile>":
      | PROPERTY | VALUE                          |
      | path     | ./charts/test-nginx-0.1.0.tgz |
    And Helm Chart known as "<LocalArchiveNginxHelmChart>":
      | PROPERTY | VALUE            |
      | chart    | <NginxChartFile> |
    And Helm Chart known as "<LocalArchiveNginxHelmChart>" has:
      | KEY         | CONDITION | VALUE       |
      | apiVersion  | equals    | v2          |
      | name        | equals    | test-nginx  |
      | description | contains  | nginx       |
      | type        | equals    | application |
      | version     | equals    | 0.1.0       |
      | appVersion  | equals    | 1.27        |

  Scenario: Defining URL Chart
    Given URL known as "<NginxChartUrl>":
      | PROPERTY | VALUE                                                              |
      | value    | https://charts.bitnami.com/bitnami/nginx-18.2.5.tgz |
    And Helm Chart known as "<UrlNginxHelmChart>":
      | PROPERTY | VALUE           |
      | chart    | <NginxChartUrl> |
    And Helm Chart known as "<UrlNginxHelmChart>" has:
      | KEY         | CONDITION | VALUE  |
      | apiVersion  | equals    | v2     |
      | name        | equals    | nginx  |
      | description | contains  | NGINX  |
      | type        | undefined |        |
      | version     | equals    | 18.2.5 |
      | appVersion  | equals    | 1.27.2 |

  Scenario: Defining Reference Chart
    Given URL known as "<BitnamiRepoUrl>":
      | PROPERTY | VALUE                              |
      | value    | https://charts.bitnami.com/bitnami |
    And Helm Repo known as "<BitnamiHelmRepo>":
      | PROPERTY | VALUE             |
      | name     | bitnami           |
      | url      | <BitnamiRepoUrl> |
    When I add Helm Repo known as "<BitnamiHelmRepo>"
    And Helm Chart known as "<ReferenceNginxHelmChart>":
      | PROPERTY | VALUE         |
      | chart    | bitnami/nginx |
      | version  | 25.1.10       |
    And Helm Chart known as "<ReferenceNginxHelmChart>" has:
      | KEY         | CONDITION | VALUE    |
      | apiVersion  | equals    | v2       |
      | name        | equals    | nginx    |
      | description | contains  | NGINX    |
      | type        | undefined |          |
      | version     | equals    | 25.1.10  |
      | appVersion  | equals    | 1.31.5   |

  Scenario: Defining Reference Chart via Repo
    Given URL known as "<BitnamiRepoUrl>":
      | PROPERTY | VALUE                              |
      | value    | https://charts.bitnami.com/bitnami |
    And Helm Chart known as "<RepoReferenceNginxHelmChart>":
      | PROPERTY | VALUE            |
      | chart    | nginx            |
      | repo     | <BitnamiRepoUrl> |
      | version  | 25.1.10          |
    And Helm Chart known as "<RepoReferenceNginxHelmChart>" has:
      | KEY         | CONDITION | VALUE   |
      | apiVersion  | equals    | v2      |
      | name        | equals    | nginx   |
      | description | contains  | NGINX   |
      | type        | undefined |         |
      | version     | equals    | 25.1.10 |
      | appVersion  | equals    | 1.31.5  |

  Scenario: Defining OCI Chart
    Given OCI Artifact known as "<NginxOciArtifact>":
      | PROPERTY | VALUE                                                     |
      | ref      | oci://registry-1.docker.io/bitnamicharts/nginx:25.1.10 |
    And Helm Chart known as "<OciNginxHelmChart>":
      | PROPERTY | VALUE               |
      | chart    | <NginxOciArtifact> |
    And Helm Chart known as "<OciNginxHelmChart>" has:
      | KEY         | CONDITION | VALUE   |
      | apiVersion  | equals    | v2      |
      | name        | equals    | nginx   |
      | description | contains  | NGINX   |
      | type        | undefined |         |
      | version     | equals    | 25.1.10 |
      | appVersion  | equals    | 1.31.5  |

  Scenario: Templating a Helm Chart
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    When I template Helm Chart known as "<LocalNginxHelmChart>" with:
      | OPTION | VALUE      |
      |        | test-nginx |
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                                       |
      | STDOUT | contains  | # Source: test-nginx/templates/service.yaml |

  Scenario: Showing a Helm Chart's definition
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    When I show chart for Helm Chart known as "<LocalNginxHelmChart>"
    Then the command result data has:
      | KEY  | CONDITION | VALUE      |
      | name | equals    | test-nginx |

  Scenario: Showing a Helm Chart's values
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    When I show values for Helm Chart known as "<LocalNginxHelmChart>"
    Then the command result data has:
      | KEY          | CONDITION | VALUE |
      | replicaCount | equals    | 1     |

  Scenario: Showing a Helm Chart's README
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    When I show readme for Helm Chart known as "<LocalNginxHelmChart>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE                          |
      | STDOUT | contains  | Minimal stock-nginx deployment |

  Scenario: Showing a Helm Chart's CRDs
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    When I show crds for Helm Chart known as "<LocalNginxHelmChart>" with:
      | OPTION  | VALUE |
      | --devel | True  |
    Then the command exited with 0

  Scenario: Showing all information about a Helm Chart
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    And Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
    When I show all for Helm Chart known as "<LocalNginxHelmChart>"
    Then the command exited with 0:
      | SOURCE | CONDITION | VALUE            |
      | STDOUT | contains  | name: test-nginx |
      | STDOUT | contains  | replicaCount: 1  |

  Scenario: Rejecting an unknown property
    When I attempt to define Helm Chart known as "<LocalNginxHelmChart>":
      | PROPERTY | VALUE |
      | xxx      | yyy   |
    Then it should have failed with 'HelmChart has no field "xxx"'

  Scenario: Rejecting an ambiguous chart reference
    When I attempt to define Helm Chart known as "<AmbiguousHelmChart>":
      | PROPERTY | VALUE |
      | chart    | nginx |
    Then it should have failed with 'Cannot determine chart reference kind for "nginx"'

  Scenario: Rejecting a nonexistent raw directory path
    When I attempt to define Helm Chart known as "<MissingDirectoryHelmChart>":
      | PROPERTY | VALUE            |
      | chart    | ./does-not-exist |
    Then it should have failed with 'HelmChart local directory does not exist'

  Scenario: Rejecting a nonexistent raw archive path
    When I attempt to define Helm Chart known as "<MissingArchiveHelmChart>":
      | PROPERTY | VALUE                |
      | chart    | ./does-not-exist.tgz |
    Then it should have failed with 'HelmChart local archive does not exist'

  Scenario: Rejecting a version pin on a non-reference chart source
    Given Directory known as "<NginxChartDirectory>":
      | PROPERTY | VALUE                |
      | path     | ./charts/test-nginx |
    When I attempt to define Helm Chart known as "<PinnedLocalHelmChart>":
      | PROPERTY | VALUE                 |
      | chart    | <NginxChartDirectory> |
      | version  | 0.1.0                 |
    Then it should have failed with 'HelmChart "version" is only valid for a reference chart'
