import { setWorldConstructor, World as CucumberWorld, IWorldOptions } from '@cucumber/cucumber';
import { Directory } from './aliases/directory.js';
import { ChartFile } from './aliases/file.js';
import { OciArtifact } from './aliases/oci_artifact.js';
import { ChartUrl } from './aliases/url.js';
import { HelmChart } from './helm/helm_chart.js';
import { HelmRepo } from './helm/helm_repo.js';
import { HelmRelease } from './helm/helm_release.js';
import { Deployment } from './k8s/deployment.js';
import { Service } from './k8s/service.js';
import { Pod } from './k8s/pod.js';
import { ConfigMap } from './k8s/configmap.js';
import { ReplicaSet } from './k8s/replicaset.js';
import { RestEndpoint } from './http/rest_endpoint.js';
import { HttpResponse } from './http/http_request.js';
import { CommandResult } from './run_command.js';

export class World extends CucumberWorld {
  charts = new Map<string, HelmChart>();
  repos = new Map<string, HelmRepo>();
  helmReleases = new Map<string, HelmRelease>();
  directories = new Map<string, Directory>();
  files = new Map<string, ChartFile>();
  urls = new Map<string, ChartUrl>();
  ociArtifacts = new Map<string, OciArtifact>();
  deployments = new Map<string, Deployment>();
  services = new Map<string, Service>();
  pods = new Map<string, Pod>();
  configMaps = new Map<string, ConfigMap>();
  replicaSets = new Map<string, ReplicaSet>();
  restEndpoints = new Map<string, RestEndpoint>();
  capturedValues = new Map<string, string>();
  lastError?: Error;
  lastCommandResult?: CommandResult;
  lastHttpResponse?: HttpResponse;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(World);
