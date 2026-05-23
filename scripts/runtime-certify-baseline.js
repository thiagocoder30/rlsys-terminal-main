const { readFileSync } = require("node:fs");
const {
  RuntimeBaselinePolicyFactory,
} = require("../dist/application/runtime/RuntimeBaselineCertificationProfile.js");
const {
  RuntimeEnduranceCertificationEngine,
} = require("../dist/application/runtime/RuntimeEnduranceCertificationEngine.js");
const {
  RuntimeEnduranceReportReader,
  RuntimeEnduranceTrendAnalyzer,
} = require("../dist/application/runtime/RuntimeEnduranceReportReader.js");
const {
  RuntimeEnduranceCliReporter,
} = require("../dist/application/runtime/RuntimeEnduranceCliReporter.js");

function parseArgs(argv) {
  const config = {
    profile: "MOBILE_CONSERVATIVE",
    inputs: [],
    compact: false,
  };

  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];

    if (key === "--profile") {
      config.profile = String(argv[index + 1]);
      index += 1;
    } else if (key === "--input") {
      config.inputs.push(String(argv[index + 1]));
      index += 1;
    } else if (key === "--compact") {
      config.compact = true;
    }
  }

  return config;
}

function exitCode(status) {
  if (status === "READY") {
    return 0;
  }

  if (status === "WARNING") {
    return 2;
  }

  return 1;
}

function main() {
  const config = parseArgs(process.argv);

  if (config.inputs.length === 0) {
    console.error("[RL.SYS CERTIFY] At least one --input report is required.");
    process.exit(1);
  }

  const factory = new RuntimeBaselinePolicyFactory();
  const profile = factory.create(config.profile);
  const reader = new RuntimeEnduranceReportReader();
  const certificationEngine = new RuntimeEnduranceCertificationEngine();
  const analyzer = new RuntimeEnduranceTrendAnalyzer(certificationEngine);
  const reporter = new RuntimeEnduranceCliReporter();

  const sources = config.inputs.map((input) => ({
    name: input,
    content: readFileSync(input, "utf8"),
  }));

  const reports = reader.readMany(sources);
  const namedReports = reports.map((report, index) => ({
    name: config.inputs[index] ?? `report-${index}`,
    report,
  }));

  const summary = analyzer.analyze(namedReports, profile.policy);
  const rendered = reporter.render(summary, {
    compact: config.compact,
  });

  console.log(`Baseline: ${profile.label}`);
  console.log(`Hardware: ${profile.hardwareClass}`);
  console.log(rendered.text);

  process.exitCode = exitCode(rendered.status);
}

try {
  main();
} catch (error) {
  console.error("[RL.SYS CERTIFY] fatal error");

  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(String(error));
  }

  process.exit(1);
}
