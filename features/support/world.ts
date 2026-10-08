import { setWorldConstructor, World as CucumberWorld, IWorldOptions } from '@cucumber/cucumber';
import { Directory } from './resources/directory.js';
import { ChartFile } from './resources/file.js';
import { OciArtifact } from './resources/oci_artifact.js';
import { ChartUrl } from './resources/url.js';
import { HelmChart } from './helm/helm_chart.js';
import { HelmRepo } from './helm/helm_repo.js';
import { HelmRelease } from './helm/helm_release.js';
import { DockerBuildxBuilder } from './docker/docker_buildx_builder.js';
import { SshKeyPair } from './ssh/ssh_key_pair.js';
import { SelfSignedCa } from './tls/self_signed_ca.js';
import { TlsCertificate } from './tls/tls_certificate.js';
import { Deployment } from './k8s/deployment.js';
import { Service } from './k8s/service.js';
import { Pod } from './k8s/pod.js';
import { ConfigMap } from './k8s/configmap.js';
import { ReplicaSet } from './k8s/replicaset.js';
import { Secret } from './k8s/secret.js';
import { PendingSelector } from './k8s/discover.js';
import { RestEndpoint } from './http/rest_endpoint.js';
import { HttpResponse, RequestRow } from './http/http_request.js';
import { CommandResult } from './run_command.js';

export class World extends CucumberWorld {
  charts = new Map<string, HelmChart>();
  repos = new Map<string, HelmRepo>();
  helmReleases = new Map<string, HelmRelease>();
  dockerBuildxBuilders = new Map<string, DockerBuildxBuilder>();
  sshKeyPairs = new Map<string, SshKeyPair>();
  selfSignedCas = new Map<string, SelfSignedCa>();
  tlsCertificates = new Map<string, TlsCertificate>();
  directories = new Map<string, Directory>();
  files = new Map<string, ChartFile>();
  urls = new Map<string, ChartUrl>();
  ociArtifacts = new Map<string, OciArtifact>();
  deployments = new Map<string, Deployment>();
  services = new Map<string, Service>();
  pods = new Map<string, Pod>();
  configMaps = new Map<string, ConfigMap>();
  replicaSets = new Map<string, ReplicaSet>();
  secrets = new Map<string, Secret>();
  pendingSelectors = new Map<string, PendingSelector>();
  restEndpoints = new Map<string, RestEndpoint>();
  pendingRequests = new Map<string, RequestRow[]>();
  pendingPayloads = new Map<string, Record<string, string>>();
  capturedValues = new Map<string, string>();
  lastError?: Error;
  lastCommandResult?: CommandResult;
  lastHttpResponse?: HttpResponse;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(World);
