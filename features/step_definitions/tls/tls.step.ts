import { DataTable, Given, When } from '@cucumber/cucumber';
import { World } from '../../support/world.js';
import { SelfSignedCa, selfSignedCaFromFields, selfSignedCaFromTable } from '../../support/tls/self_signed_ca.js';
import { TlsCertificate, tlsCertificateFromFields, tlsCertificateFromTable } from '../../support/tls/tls_certificate.js';
import { buildArgs, runCommand } from '../../support/run_command.js';
import { resolveResource } from '../../support/resources/resolve_resource.js';
import { attempt } from '../../support/attempt.js';
import { getPendingPayload } from '../common.step.js';
import { substituteTableCapturedValues } from '../../support/http/capture.js';

// --- Self-Signed CA ---

Given('Self-Signed CA known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.selfSignedCas.set(alias, selfSignedCaFromTable(dataTable, (a) => resolveResource(this, a)));
});
Given('Self-Signed CA {string} in {string}', function (this: World, alias: string, directory: string) {
  this.selfSignedCas.set(alias, selfSignedCaFromFields({ directory }, (a) => resolveResource(this, a)));
});
When('I attempt to define Self-Signed CA known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.selfSignedCas.set(alias, selfSignedCaFromTable(dataTable, (a) => resolveResource(this, a)));
  });
});
When('I attempt to define Self-Signed CA known as {string} using {string}', function (this: World, alias: string, payloadAlias: string) {
  return attempt(this, () => {
    this.selfSignedCas.set(alias, selfSignedCaFromFields(getPendingPayload(this, payloadAlias), (a) => resolveResource(this, a)));
  });
});

function getDirectoryPath(world: World, alias: string): string {
  const dir = world.directories.get(alias);
  if (!dir) {
    throw new Error(`No Directory registered as "${alias}"`);
  }
  return dir.path;
}

// Structural flags (-x509/-newkey rsa:2048/-nodes/-keyout/-out) are
// fixed - they're what make ca-key.pem/ca-cert.pem the real,
// re-discoverable file names SelfSignedCa's constructor expects.
// Everything else (-days, -subj, ...) is real, table-driven `openssl`
// argv - nothing implied by step text.
When('I generate Self-Signed CA known as {string} in Directory known as {string} with:', function (this: World, alias: string, dirAlias: string, table: DataTable) {
  const directoryPath = getDirectoryPath(this, dirAlias);
  this.lastCommandResult = runCommand('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', `${directoryPath}/ca-key.pem`,
    '-out', `${directoryPath}/ca-cert.pem`,
    ...buildArgs(substituteTableCapturedValues(this, table)),
  ]);
  if (this.lastCommandResult.EXIT_CODE === '0') {
    this.selfSignedCas.set(alias, new SelfSignedCa({ directory: directoryPath }));
  }
});
When('I generate Self-Signed CA {string} in Directory known as {string} with {flags}', function (this: World, alias: string, dirAlias: string, flags: string[]) {
  const directoryPath = getDirectoryPath(this, dirAlias);
  this.lastCommandResult = runCommand('openssl', [
    'req', '-x509', '-newkey', 'rsa:2048', '-nodes',
    '-keyout', `${directoryPath}/ca-key.pem`,
    '-out', `${directoryPath}/ca-cert.pem`,
    ...flags,
  ]);
  if (this.lastCommandResult.EXIT_CODE === '0') {
    this.selfSignedCas.set(alias, new SelfSignedCa({ directory: directoryPath }));
  }
});

// --- TLS Certificate ---

Given('TLS Certificate known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  this.tlsCertificates.set(alias, tlsCertificateFromTable(dataTable, (a) => resolveResource(this, a)));
});
Given('TLS Certificate {string} in {string}', function (this: World, alias: string, directory: string) {
  this.tlsCertificates.set(alias, tlsCertificateFromFields({ directory }, (a) => resolveResource(this, a)));
});
When('I attempt to define TLS Certificate known as {string}:', function (this: World, alias: string, dataTable: DataTable) {
  return attempt(this, () => {
    this.tlsCertificates.set(alias, tlsCertificateFromTable(dataTable, (a) => resolveResource(this, a)));
  });
});
When('I attempt to define TLS Certificate known as {string} using {string}', function (this: World, alias: string, payloadAlias: string) {
  return attempt(this, () => {
    this.tlsCertificates.set(alias, tlsCertificateFromFields(getPendingPayload(this, payloadAlias), (a) => resolveResource(this, a)));
  });
});

function getCa(world: World, alias: string): SelfSignedCa {
  const ca = world.selfSignedCas.get(alias);
  if (!ca) {
    throw new Error(`No SelfSignedCa registered as "${alias}"`);
  }
  return ca;
}

// Real 2-step chain, two sequential real `runCommand` calls (never a
// shell `&&`): a real CSR (table-driven - -subj/-addext/etc, nothing
// implied), then a real signature by the CA. `-copy_extensions copyall`
// on the signing half carries any `-addext` (e.g. a SAN) from the CSR
// into the final cert - modern `openssl x509 -req` doesn't do this by
// default, and this avoids needing a separate SAN extfile. `lastCommandResult`
// ends up holding the *signing* step's result (the one that produces the
// real, final tls-cert.pem) - a scenario asserting on the CSR step
// itself would need its own dedicated step, not needed by anything here.
When(
  'I generate TLS Certificate known as {string} in Directory known as {string} signed by Self-Signed CA known as {string} with:',
  function (this: World, alias: string, dirAlias: string, caAlias: string, table: DataTable) {
    const directoryPath = getDirectoryPath(this, dirAlias);
    const ca = getCa(this, caAlias);
    const csrPath = `${directoryPath}/tls.csr`;
    const csrResult = runCommand('openssl', [
      'req', '-new', '-newkey', 'rsa:2048', '-nodes',
      '-keyout', `${directoryPath}/tls-key.pem`,
      '-out', csrPath,
      ...buildArgs(substituteTableCapturedValues(this, table)),
    ]);
    if (csrResult.EXIT_CODE !== '0') {
      this.lastCommandResult = csrResult;
      return;
    }
    this.lastCommandResult = runCommand('openssl', [
      'x509', '-req',
      '-in', csrPath,
      '-CA', ca.certPath,
      '-CAkey', ca.keyPath,
      '-CAcreateserial',
      '-copy_extensions', 'copyall',
      '-days', '2',
      '-out', `${directoryPath}/tls-cert.pem`,
    ]);
    if (this.lastCommandResult.EXIT_CODE === '0') {
      this.tlsCertificates.set(alias, new TlsCertificate({ directory: directoryPath }));
    }
  },
);
