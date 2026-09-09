import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { OciArtifact, ociArtifactFromTable } from '../../support/resources/oci_artifact.js';
import { attempt } from '../../support/attempt.js';
import { getPendingPayload } from '../common.step.js';

Given('OCI Artifact known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.ociArtifacts.set(alias, ociArtifactFromTable(dataTable));
});

// Oneline form - OCI Artifact has exactly one real field (`ref`); the table
// form stays for the negative-path tests in features/resources/oci-artifact-{short,full}.feature.
Given('OCI Artifact {string} at {string}', function (this: World, alias: string, ref: string) {
  this.ociArtifacts.set(alias, new OciArtifact({ ref }));
});

When('I attempt to define OCI Artifact known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.ociArtifacts.set(alias, ociArtifactFromTable(dataTable));
  });
});

When('I attempt to define OCI Artifact known as {string} using {string}', function (this: World, alias: string, payloadAlias: string) {
  return attempt(this, () => {
    this.ociArtifacts.set(alias, new OciArtifact(getPendingPayload(this, payloadAlias)));
  });
});
