const DOMAIN_CONFIGS = [
  {
    key: "housing",
    match: /(housing|rent|tenant|landlord|evict|property|building|permit|zoning|vacan|parcel|assessor|code[_ ]?violation|inspection)/i,
    datasetFollowUp(context) {
      return [
        "ACS or Census tables on renter households, income, race, and housing burden for the same geography",
        "Court eviction filings, landlord-tenant case records, or housing-court calendars if the topic touches eviction or enforcement",
        "Parcel, assessor, deed, or landlord-ownership datasets to connect outcomes to buildings or owners when property-level work matters",
        "Housing complaints, code-violation, permit, or inspection datasets from the same city to validate whether the pattern appears in parallel systems"
      ];
    },
    leadFollowUp(context) {
      return [
        `ACS demographics and renter-population denominators for the ${context.groupLabelLower} categories or places relevant to this lead`,
        `Housing complaints, code-violation, permit, or inspection records that can confirm whether the ${context.metricLabelLower} gap appears in related measures`,
        "Property-level ownership or parcel records to test whether a small number of buildings or landlords drive the pattern",
        "Historical snapshots of the same housing dataset to see whether the disparity appears before and after policy or enforcement changes"
      ];
    },
    interviews: [
      "Housing policy researchers",
      "Tenant advocates, legal-aid attorneys, or fair-housing groups",
      "Neighborhood organizations in the highest- and lowest-affected areas"
    ],
    agencies: [
      "City or county housing department",
      "Building inspections or code-enforcement office",
      "Housing court, clerk's office, or public housing authority"
    ],
    records: [
      "Inspection manuals, enforcement policies, and complaint triage procedures",
      "Case-level enforcement logs, appeal files, or remediation records",
      "Internal audits or backlog reports on inspections, permits, or housing complaints"
    ],
    cautions: [
      "Apparent housing disparities can reflect complaint-driven enforcement, landlord mix, or neighborhood targeting rather than unequal treatment by itself.",
      "Property or neighborhood composition may explain part of the gap, so building-level and geography-level checks matter before advancing the story."
    ]
  },
  {
    key: "education",
    match: /(school|education|student|teacher|discipline|enrollment|attendance|graduation|district|campus|classroom)/i,
    datasetFollowUp() {
      return [
        "Enrollment denominators by grade, school, district, race, income, disability, or language status",
        "District or school demographic profiles to compare composition across the affected groups",
        "Budget, staffing, course access, or program-allocation data for the same schools or districts",
        "Historical school-performance, attendance, or discipline releases to test whether the gap is persistent"
      ];
    },
    leadFollowUp(context) {
      return [
        `Enrollment and demographic baselines for the ${context.groupLabelLower} groups implicated in this lead`,
        `School- or district-level comparison data to see whether the ${context.metricLabelLower} gap is concentrated in particular schools`,
        "Staffing, spending, or program-access datasets that could challenge or contextualize the pattern",
        "Policy-change timelines around discipline, grading, attendance, or accountability rules"
      ];
    },
    interviews: [
      "Education policy researchers",
      "Parent advocates, student advocates, or civil-rights groups",
      "Teacher, principal, or district leadership associations"
    ],
    agencies: [
      "School district administration",
      "State education department",
      "School board, accountability office, or charter authorizer"
    ],
    records: [
      "Discipline, attendance, accountability, or program-eligibility policies",
      "Board packets, superintendent memos, or school-improvement plans",
      "Audit reports or internal analyses of school-level disparities"
    ],
    cautions: [
      "Education gaps can reflect enrollment mix, grade mix, program eligibility, or reporting changes rather than a simple institutional disparity.",
      "School- and district-level composition can distort averages, so denominator and school-level comparisons are important."
    ]
  },
  {
    key: "policing",
    match: /(police|sheriff|stop|arrest|citation|ticket|crime|jail|officer|precinct|beat|complaint|use[_ ]?of[_ ]?force)/i,
    datasetFollowUp() {
      return [
        "Population, driving, or resident baselines for the same geography and demographic groups",
        "Calls-for-service, deployment, patrol, or staffing datasets to test whether enforcement exposure differs across places",
        "Civilian complaint, use-of-force, misconduct, or disciplinary records",
        "Court disposition, prosecutor, or jail booking records that can validate what happened after the stop or arrest"
      ];
    },
    leadFollowUp(context) {
      return [
        `Demographic and geographic baselines to show whether the ${context.groupLabelLower} gap remains after accounting for exposure or population`,
        `Calls-for-service, deployment, or officer-assignment data that could explain the ${context.metricLabelLower} difference`,
        "Complaint, use-of-force, or disciplinary records to test whether related accountability patterns point the same way",
        "Policy change timelines around stop, search, arrest, or traffic-enforcement rules"
      ];
    },
    interviews: [
      "Criminologists or policing researchers",
      "Civil-rights groups, public defenders, or police accountability advocates",
      "Residents or organizers in the most- and least-affected areas"
    ],
    agencies: [
      "Police department or sheriff's office",
      "Civilian oversight board, inspector general, or consent-decree monitor",
      "Court administration, prosecutor, or public defender office"
    ],
    records: [
      "Stop, arrest, traffic-enforcement, or search policies and training materials",
      "Complaint summaries, disciplinary files, or force review memos",
      "Deployment plans, staffing memos, or internal audits of enforcement patterns"
    ],
    cautions: [
      "Counts in policing datasets can reflect deployment, geography, and exposure differences as much as decision-making at the encounter level.",
      "Before advancing a policing lead, check whether denominators, dispatch patterns, or policy changes could explain the gap."
    ]
  },
  {
    key: "health",
    match: /(health|hospital|clinic|food|restaurant|sanitation|medical|mortality|disease|inspection|license|facility)/i,
    datasetFollowUp() {
      return [
        "Population denominators and demographic baselines for the same geography or facility catchment areas",
        "Licensing, complaint, sanction, or closure records tied to the same facilities",
        "Inspection histories or repeat-violation records that show whether the pattern is persistent",
        "Historical public health or facility-performance releases to test whether the gap is stable"
      ];
    },
    leadFollowUp(context) {
      return [
        `Facility-level inspection, licensing, or complaint data to see whether the ${context.metricLabelLower} difference appears in related oversight records`,
        `Population or service-area denominators for the ${context.groupLabelLower} categories involved in this lead`,
        "Corrective-action plans, sanctions, or repeat-offender histories that could validate the signal",
        "Policy or inspection-rule changes that may affect how the outcome was recorded"
      ];
    },
    interviews: [
      "Public health researchers or epidemiologists",
      "Consumer-protection, patient, or community health advocates",
      "Industry, facility, or operator representatives where relevant"
    ],
    agencies: [
      "Local public health department",
      "State licensing or health oversight agency",
      "Facility oversight office or health inspector general"
    ],
    records: [
      "Inspection protocols, scoring rubrics, and enforcement guidance",
      "Complaint investigations, sanctions, or corrective-action plans",
      "Methodology documents defining the core health or inspection outcome fields"
    ],
    cautions: [
      "Inspection or health datasets often reflect complaint patterns, inspection frequency, or reporting changes, not just underlying harm.",
      "Facility size, case mix, or catchment area can create misleading differences if denominator data is missing."
    ]
  },
  {
    key: "transportation",
    match: /(transit|bus|train|traffic|transportation|street[_ ]?safety|crash|parking|ride|ridership|route)/i,
    datasetFollowUp() {
      return [
        "Ridership, traffic volume, or trip-exposure denominators for the same routes or corridors",
        "Service-frequency, maintenance, or on-time-performance data for the same system",
        "Capital spending, project selection, or street redesign records affecting the same geography",
        "Historical crash, delay, or reliability data to test persistence before and after policy changes"
      ];
    },
    leadFollowUp(context) {
      return [
        `Exposure denominators, such as ridership or traffic volume, for the ${context.groupLabelLower} groups or geographies in this lead`,
        `Service-frequency, maintenance, or route-allocation data to see whether the ${context.metricLabelLower} gap tracks service differences`,
        "Crash, complaint, or reliability records from the same corridor or agency",
        "Policy or capital-change timelines that may have altered service or safety outcomes"
      ];
    },
    interviews: [
      "Transportation planners or street-safety researchers",
      "Transit rider groups or mobility advocates",
      "Neighborhood groups affected by service or safety disparities"
    ],
    agencies: [
      "Transportation department or transit agency",
      "Streets department or metropolitan planning organization",
      "Transit oversight board or inspector general"
    ],
    records: [
      "Service standards, route-planning memos, or maintenance schedules",
      "Crash review summaries, traffic studies, or reliability audits",
      "Budget documents, capital plans, or project scoring sheets"
    ],
    cautions: [
      "Transportation disparities can reflect exposure, route design, and investment history rather than only current agency behavior.",
      "Without corridor-level or ridership denominators, raw counts and averages can overstate the meaning of the gap."
    ]
  }
];

const DEMOGRAPHIC_PATTERNS = /(race|ethnic|income|poverty|gender|sex|age|language|disabil|majority|renter|owner|student[_ ]?group|english|immigrant|insurance)/i;
const GEOGRAPHIC_PATTERNS =
  /((^|_)(borough|ward|district|county|city|state|zip|postal|tract|block|neighborhood|community[_ ]?area|precinct|beat|region|address|street|parcel|location|school|campus|facility|site)(_|$))/i;
const TIME_PATTERNS =
  /((^|_)(date|year|month|quarter|week|period|fiscal|calendar|school[_ ]?year|term|timestamp|created|updated|modified)(_|$)|(_at$))/i;
const DENOMINATOR_PATTERNS = /(population|enrollment|students|households|household|residents|renter|units|beds|ridership|traffic|calls[_ ]?for[_ ]?service|applications|caseload|workload|exposure)/i;
const PROPERTY_PATTERNS = /(parcel|property|building|address|owner|landlord|unit|permit|deed|assessment|assessor)/i;
const INSTITUTION_PATTERNS = /(school|district|campus|hospital|clinic|restaurant|facility|provider|agency|precinct|beat|route|station)/i;
const OUTCOME_PATTERNS = /(rate|pct|percent|share|count|total|days|hours|wait|response|inspection|violation|complaint|stop|arrest|score|graduation|attendance|enrollment|eviction|filing|denial|approval|closure|delay|backlog|unresolved)/i;
const ADMINISTRATIVE_METRIC_PATTERNS = /(id|key|number|sequence|ward|district|tract|zip|postal|coord|latitude|longitude|community[_ ]?area|code)/i;

export function buildDatasetValidationGuidance(candidate, review = {}) {
  const context = buildContext({
    title: candidate.title,
    description: candidate.description,
    sourceType: review.sourceCredibility?.sourceType,
    publisher: review.sourceCredibility?.publisher || candidate.publisher,
    groupColumns: review.dataQuality?.likelyGroupColumns || [],
    metricColumns: review.dataQuality?.likelyMetricColumns || [],
    geographicColumns: review.dataQuality?.likelyGeographicColumns || [],
    timeColumns: review.dataQuality?.likelyTimeColumns || [],
    limitations: review.dataQuality?.limitations || [],
    usability: review.dataQuality?.usability?.status,
    sourceReasoning: review.sourceCredibility?.heuristicReliability?.reasoning || "",
    dataReasoning: review.dataQuality?.usability?.reasoning || "",
    missingness: review.dataQuality?.missingness || "",
    rowCount: review.dataQuality?.rowCount,
    sampledRowCount: review.dataQuality?.sampledRowCount
  });

  return {
    followUpDataSuggestions: buildDatasetFollowUpData(context),
    missingFieldsOrComparisons: buildDatasetMissingChecks(context),
    reportingSuggestions: buildReportingSuggestions(context, "dataset"),
    cautionAndValidationNotes: buildDatasetCautions(context)
  };
}

export function buildLeadValidationGuidance({ lead, analysis, discoveryReview = null }) {
  const context = buildContext({
    title: lead.headline,
    description: `${lead.patternFound} ${lead.whyItMayMatter}`,
    sourceType: discoveryReview?.sourceCredibility?.sourceType || null,
    publisher: discoveryReview?.sourceCredibility?.publisher || null,
    groupColumns: analysis?.detectedColumns?.groupColumns || [],
    metricColumns: analysis?.detectedColumns?.metricColumns || [],
    geographicColumns: discoveryReview?.dataQuality?.likelyGeographicColumns || analysis?.detectedColumns?.geographicColumns || [],
    timeColumns: discoveryReview?.dataQuality?.likelyTimeColumns || analysis?.detectedColumns?.timeColumns || [],
    limitations: discoveryReview?.dataQuality?.limitations || [],
    usability: discoveryReview?.dataQuality?.usability?.status || null,
    sourceReasoning: discoveryReview?.sourceCredibility?.heuristicReliability?.reasoning || "",
    dataReasoning: discoveryReview?.dataQuality?.usability?.reasoning || "",
    missingness: discoveryReview?.dataQuality?.missingness || "",
    rowCount: analysis?.dataset?.rowCount,
    sampledRowCount: analysis?.dataset?.rowCount,
    leadGroupColumn: lead.comparison?.groupColumn || "",
    leadMetricColumn: lead.comparison?.metricColumn || "",
    leadInterviews: lead.whoToInterview || []
  });

  const evidenceChain = buildLeadEvidenceChain(context);

  return {
    baselineOrDenominatorGuidance: evidenceChain.baselineOrDenominatorGuidance,
    secondarySourceRecommendations: evidenceChain.secondarySourceRecommendations,
    claimLimitations: evidenceChain.claimLimitations,
    followUpDataSuggestions: buildLeadFollowUpData(context, evidenceChain),
    missingFieldsOrComparisons: buildLeadMissingChecks(context, evidenceChain),
    reportingSuggestions: buildReportingSuggestions(context, "lead"),
    cautionAndValidationNotes: buildLeadCautions(context, evidenceChain)
  };
}

function buildContext(input) {
  const allFields = uniqueItems([
    ...(input.groupColumns || []),
    ...(input.metricColumns || []),
    ...(input.geographicColumns || []),
    ...(input.timeColumns || []),
    input.leadGroupColumn,
    input.leadMetricColumn
  ]);
  const text = [input.title, input.description, allFields.join(" ")].filter(Boolean).join(" ");
  const domain = inferDomain(text);
  const config = getDomainConfig(domain);
  const demographicFields = allFields.filter((field) => DEMOGRAPHIC_PATTERNS.test(field));
  const geographyFields = uniqueItems([
    ...(input.geographicColumns || []),
    ...allFields.filter((field) => GEOGRAPHIC_PATTERNS.test(field))
  ]);
  const timeFields = uniqueItems([
    ...(input.timeColumns || []),
    ...allFields.filter((field) => TIME_PATTERNS.test(field))
  ]);
  const denominatorFields = allFields.filter((field) => DENOMINATOR_PATTERNS.test(field));
  const propertyFields = allFields.filter((field) => PROPERTY_PATTERNS.test(field));
  const institutionFields = allFields.filter((field) => INSTITUTION_PATTERNS.test(field));
  const outcomeFields = (input.metricColumns || []).filter((field) => OUTCOME_PATTERNS.test(field));
  const administrativeMetrics = (input.metricColumns || []).filter((field) => ADMINISTRATIVE_METRIC_PATTERNS.test(field));
  const missingnessValue = parseLeadingPercent(input.missingness);

  return {
    ...input,
    domain,
    config,
    text,
    allFields,
    demographicFields,
    geographyFields,
    timeFields,
    denominatorFields,
    propertyFields,
    institutionFields,
    outcomeFields,
    administrativeMetrics,
    highMissingness: missingnessValue !== null && missingnessValue >= 20,
    groupLabel: humanize(input.leadGroupColumn || input.groupColumns?.[0] || "group"),
    metricLabel: humanize(input.leadMetricColumn || input.metricColumns?.[0] || "metric"),
    groupLabelLower: humanize(input.leadGroupColumn || input.groupColumns?.[0] || "group").toLowerCase(),
    metricLabelLower: humanize(input.leadMetricColumn || input.metricColumns?.[0] || "metric").toLowerCase()
  };
}

function buildDatasetFollowUpData(context) {
  return uniqueItems([
    ...context.config.datasetFollowUp(context),
    context.geographyFields.length
      ? `Cross-walk or benchmark data for ${describeGeographyContext(context)} so results can be compared against population, poverty, renter, or enrollment baselines`
      : "A geography or boundary crosswalk to compare outcomes across places rather than only across records",
    !context.timeFields.length
      ? "A dated or historical version of the dataset so the same issue can be checked over time"
      : `Prior months or years of ${context.title.toLowerCase()} so the same pattern can be tested over time`,
    !context.denominatorFields.length
      ? buildDenominatorSuggestion(context)
      : null,
    context.sourceType === "government"
      ? "An oversight, audit, or inspector-general dataset covering the same program or agency"
      : "A second public administrative source covering the same issue from another institution"
  ]).slice(0, 5);
}

function buildLeadFollowUpData(context, evidenceChain = null) {
  return uniqueItems([
    ...(evidenceChain?.secondarySourceRecommendations || []).map((item) => item.datasetType),
    ...context.config.leadFollowUp(context),
    evidenceChain?.baselineOrDenominatorGuidance?.summary || buildDenominatorSuggestion(context),
    context.geographyFields.length
      ? `Geographic comparison data for ${describeGeographyContext(context)} to test whether the ${context.metricLabelLower} gap is concentrated in particular places`
      : `A geographic field or neighborhood crosswalk so the ${context.metricLabelLower} gap can be checked by place`,
    context.timeFields.length
      ? `Trend data using ${formatFieldList(context.timeFields)} to test whether the ${context.metricLabelLower} gap is temporary or persistent`
      : `A date or period field to test whether the ${context.metricLabelLower} gap appears consistently over time`,
    context.administrativeMetrics.length
      ? `A second outcome field beyond administrative codes like ${formatFieldList(context.administrativeMetrics)} so the lead rests on a substantive measure`
      : null
  ]).slice(0, 5);
}

function buildDatasetMissingChecks(context) {
  return uniqueItems([
    !context.timeFields.length
      ? "No clear time field was detected, so it will be hard to test whether the pattern persists or follows policy changes."
      : `Use ${formatFieldList(context.timeFields)} to compare before-and-after periods rather than relying on a single snapshot.`,
    !context.geographyFields.length
      ? "No clear geography field was detected, which limits place-based validation and neighborhood comparisons."
      : `Compare results across ${describeGeographyContext(context)} instead of relying on one grouping only.`,
    !context.denominatorFields.length
      ? "No obvious denominator or exposure field was detected, so raw gaps may overstate the pattern."
      : `Use denominator-style fields such as ${formatFieldList(context.denominatorFields)} when possible instead of raw counts alone.`,
    !context.demographicFields.length
      ? "No obvious demographic grouping fields were detected, so external demographic baselines may be needed for validation."
      : `Compare the apparent disparity across multiple group fields, including ${formatFieldList(context.demographicFields)}.`,
    context.propertyFields.length === 0 && context.domain === "housing"
      ? "No landlord, parcel, address, or building-level identifier was obvious in the sampled structure, so it may be hard to test whether a few properties drive the signal."
      : null,
    context.institutionFields.length === 0 && ["education", "health", "policing", "transportation"].includes(context.domain)
      ? "No obvious facility, school, precinct, route, or institutional identifier was detected, limiting comparisons across operating units."
      : null,
    context.administrativeMetrics.length >= Math.max(1, Math.ceil((context.metricColumns || []).length / 2))
      ? `Many detected numeric fields look administrative or geographic, such as ${formatFieldList(context.administrativeMetrics)}, so a reporter should confirm that a real outcome measure exists.`
      : null,
    ...context.limitations
  ]).slice(0, 5);
}

function buildLeadMissingChecks(context, evidenceChain = null) {
  return uniqueItems([
    ...(evidenceChain?.baselineOrDenominatorGuidance?.missingContextTypes || []).map(
      (item) => `Missing context: ${item}.`
    ),
    !context.timeFields.length
      ? `No clear time field was detected, so the ${context.metricLabelLower} gap cannot yet be tested across periods or policy changes.`
      : `Use ${formatFieldList(context.timeFields)} to check whether the ${context.metricLabelLower} gap holds over time.`,
    !context.geographyFields.length
      ? `No clear geography field was detected, making it hard to test whether the ${context.groupLabelLower} gap is really a place effect.`
      : `Check whether the lead still holds within ${describeGeographyContext(context)}.`,
    !context.denominatorFields.length
      ? `No denominator or exposure field was obvious, so the ${context.metricLabelLower} gap may simply reflect group size.`
      : `Compare ${context.metricLabelLower} against denominator-style fields such as ${formatFieldList(context.denominatorFields)}.`,
    context.groupColumns.length > 1
      ? `Test whether the lead holds across other group fields such as ${formatFieldList(context.groupColumns.filter((field) => field !== context.leadGroupColumn).slice(0, 3))}.`
      : null,
    context.metricColumns.length > 1
      ? `Cross-check the lead against related outcome fields such as ${formatFieldList(context.metricColumns.filter((field) => field !== context.leadMetricColumn).slice(0, 3))}.`
      : null,
    context.propertyFields.length === 0 && context.domain === "housing"
      ? "A building, parcel, or landlord identifier would help test whether a few owners or addresses are driving the lead."
      : null,
    context.institutionFields.length === 0 && context.domain === "education"
      ? "A school or district identifier would help test whether the lead is concentrated in a small number of institutions."
      : null,
    context.institutionFields.length === 0 && context.domain === "policing"
      ? "A precinct, beat, or unit identifier would help test whether the lead is driven by deployment rather than system-wide behavior."
      : null
  ]).slice(0, 6);
}

function buildReportingSuggestions(context, mode) {
  const fieldSpecificInterviews = [
    context.demographicFields.length
      ? `Community leaders or advocates tied to ${formatFieldList(context.demographicFields)} groups represented in the data`
      : null,
    context.geographyFields.length
      ? `Residents, organizers, or service providers connected to ${describeGeographyContext(context)}`
      : null,
    context.propertyFields.length
      ? "Owners, landlords, tenant organizers, or property-management stakeholders connected to the affected buildings or parcels"
      : null,
    context.institutionFields.length && context.domain === "education"
      ? "School-level administrators or district data staff who can explain institutional differences"
      : null,
    context.institutionFields.length && context.domain === "health"
      ? "Facility operators or licensing officials who can explain inspection or sanction practices"
      : null,
    context.institutionFields.length && context.domain === "policing"
      ? "Precinct commanders, oversight staff, or dispatch officials who can explain deployment and enforcement patterns"
      : null
  ];

  return {
    interviews: uniqueItems([
      ...(mode === "lead" ? context.leadInterviews || [] : []),
      ...context.config.interviews,
      ...fieldSpecificInterviews,
      "Staff responsible for how the dataset is collected, cleaned, and published"
    ]).slice(0, 5),
    agenciesOrInstitutions: uniqueItems([
      ...context.config.agencies,
      context.publisher ? `${context.publisher}` : null,
      context.sourceType === "government" ? "An inspector-general, auditor, or oversight office tied to the same program" : null
    ]).slice(0, 5),
    recordsOrDocuments: uniqueItems([
      ...context.config.records,
      "Data dictionaries, field definitions, suppression rules, and methodology notes",
      !context.timeFields.length ? "Historical versions or archived releases of the dataset" : null,
      context.highMissingness ? "Documentation explaining nulls, missing values, and late or partial reporting" : null,
      context.geographyFields.length ? `Crosswalks or lookup tables for ${describeGeographyContext(context)}` : null
    ]).slice(0, 5)
  };
}

function buildDatasetCautions(context) {
  return uniqueItems([
    "This is reporting support only. The tool is not verifying the dataset or confirming any conclusion.",
    context.sourceReasoning || null,
    context.dataReasoning || null,
    context.highMissingness ? "Sampled rows show notable missingness, so apparent gaps may reflect null patterns or incomplete reporting." : null,
    !context.denominatorFields.length ? "Without denominator or exposure data, raw gaps can exaggerate how meaningful the apparent disparity really is." : null,
    !context.timeFields.length ? "Without a time field, the current dataset acts like a snapshot and cannot show whether the pattern is persistent or tied to a short-lived event." : null,
    ...context.config.cautions,
    "Before treating this as a strong reporting direction, confirm field definitions, time coverage, geographic coverage, and whether important records are missing or delayed."
  ]).slice(0, 5);
}

function buildLeadCautions(context, evidenceChain = null) {
  return uniqueItems([
    "This lead is descriptive only and should not be treated as evidence of causation.",
    `Before advancing the lead, confirm that ${context.metricLabelLower} is measured consistently across ${context.groupLabelLower} categories.`,
    ...(evidenceChain?.claimLimitations || []),
    !context.denominatorFields.length ? `The lead could simply reflect group size because no obvious denominator or exposure field was detected.` : null,
    !context.timeFields.length ? `The lead is based on a snapshot, so it should be checked against a longer time series before treating it as a strong pattern.` : null,
    !context.geographyFields.length && context.demographicFields.length ? `The lead may partly reflect geography rather than ${context.groupLabelLower} itself, but no clear geography field was detected to test that.` : null,
    context.highMissingness ? "Missing data may differ across groups, so check whether null patterns are creating or widening the gap." : null,
    context.administrativeMetrics.includes(context.leadMetricColumn || "") ? `The selected metric, ${context.metricLabelLower}, may function partly as an administrative code or location field, so confirm it is a real outcome measure.` : null,
    ...context.config.cautions,
    "Treat this as a reporting lead and validation checklist, not as a final judgment."
  ]).slice(0, 6);
}

function buildLeadEvidenceChain(context) {
  return {
    baselineOrDenominatorGuidance: buildBaselineOrDenominatorGuidance(context),
    secondarySourceRecommendations: buildSecondarySourceRecommendations(context),
    claimLimitations: buildLeadClaimLimitations(context)
  };
}

function buildBaselineOrDenominatorGuidance(context) {
  const missingContextTypes = uniqueItems([
    !context.denominatorFields.length ? inferPrimaryBaselineType(context) : null,
    !context.timeFields.length ? "Historical benchmark" : null,
    context.groupColumns.length <= 1 ? "Peer-group comparison" : null,
    !context.geographyFields.length ? "Geographic benchmark" : null,
    !context.timeFields.length ? "Policy before/after comparison" : null
  ]);

  const summaryParts = [
    !context.denominatorFields.length ? buildDenominatorSuggestion(context) : `Use available denominator-style fields such as ${formatFieldList(context.denominatorFields)} instead of raw counts alone`,
    !context.timeFields.length ? "a longer time series or archived releases" : `historical comparisons using ${formatFieldList(context.timeFields)}`,
    !context.geographyFields.length ? "place-based comparison fields" : `geographic benchmarks within ${describeGeographyContext(context)}`,
    context.groupColumns.length <= 1 ? "a peer-group comparison beyond the current grouping" : null
  ].filter(Boolean);

  return {
    summary: `This lead still needs ${joinPhrases(summaryParts)} before it can be treated as a strong reporting direction.`,
    whyItMatters: `Without baseline context, the apparent ${context.metricLabelLower} gap may reflect group size, geography, or timing rather than a meaningful disparity.`,
    missingContextTypes
  };
}

function buildSecondarySourceRecommendations(context) {
  const recommendations = [
    buildRecommendationFromKey(context, inferPrimaryBaselineDatasetKey(context)),
    buildRecommendationFromKey(context, "historical-releases"),
    buildRecommendationFromKey(context, inferContextualDatasetKey(context)),
    buildRecommendationFromKey(context, inferCrossCheckDatasetKey(context))
  ];

  return uniqueObjectsBy(recommendations.filter(Boolean), "datasetType").slice(0, 4);
}

function buildLeadClaimLimitations(context) {
  return uniqueItems([
    !context.denominatorFields.length
      ? `You cannot yet say the ${context.groupLabelLower} difference is disproportionate without a denominator or exposure baseline.`
      : null,
    !context.timeFields.length
      ? "You cannot yet say the pattern is persistent because the current view lacks a clear time series."
      : null,
    !context.geographyFields.length
      ? "You cannot yet rule out geography as a major explanation because no strong location benchmark is available."
      : null,
    context.groupColumns.length <= 1
      ? "You cannot yet say the pattern is unique to this grouping until it is checked against peer groups or alternative categorizations."
      : null,
    context.propertyFields.length === 0 && context.domain === "housing"
      ? "You cannot yet tell whether a few buildings or landlords are driving the pattern because no strong property identifier is available."
      : null,
    context.institutionFields.length === 0 && ["education", "health", "policing", "transportation"].includes(context.domain)
      ? "You cannot yet tell whether the pattern is system-wide or concentrated in a few institutions because no clear operating-unit identifier was detected."
      : null
  ]).slice(0, 4);
}

function inferPrimaryBaselineType(context) {
  if (context.domain === "housing") {
    return context.text.match(/evict|litigat|tenant|rent/i) ? "Renter or household denominator" : "Housing-unit or renter baseline";
  }
  if (context.domain === "education") {
    return "Enrollment denominator";
  }
  if (context.domain === "policing") {
    return "Population or exposure denominator";
  }
  if (context.domain === "health") {
    return "Population, patient, or facility-volume denominator";
  }
  if (context.domain === "transportation") {
    return "Ridership, traffic, or trip-exposure denominator";
  }
  return "Population or case-volume baseline";
}

function inferPrimaryBaselineDatasetKey(context) {
  if (context.domain === "housing") {
    return context.text.match(/evict|litigat|tenant|rent/i) ? "acs-renter-demographics" : "acs-housing-baseline";
  }
  if (context.domain === "education") {
    return "education-enrollment";
  }
  if (context.domain === "policing") {
    return "acs-demographics";
  }
  if (context.domain === "health") {
    return "health-denominator";
  }
  if (context.domain === "transportation") {
    return "transportation-exposure";
  }
  return "acs-demographics";
}

function inferContextualDatasetKey(context) {
  if (context.domain === "housing") {
    return context.text.match(/evict|litigat|court/i) ? "court-records" : "complaints-inspections";
  }
  if (context.domain === "education") {
    return "district-demographics";
  }
  if (context.domain === "policing") {
    return "complaints-inspections";
  }
  if (context.domain === "health") {
    return "agency-enforcement";
  }
  if (context.domain === "transportation") {
    return "agency-enforcement";
  }
  return "peer-benchmark";
}

function inferCrossCheckDatasetKey(context) {
  if (context.domain === "housing") {
    return context.propertyFields.length ? "ownership-parcel" : "complaints-inspections";
  }
  if (context.domain === "education") {
    return "policy-context";
  }
  if (context.domain === "policing") {
    return "agency-enforcement";
  }
  if (context.domain === "health") {
    return "complaints-inspections";
  }
  if (context.domain === "transportation") {
    return "peer-benchmark";
  }
  return "historical-releases";
}

function buildRecommendationFromKey(context, key) {
  const geographyJoin = context.geographyFields.length
    ? describeGeographyContext(context)
    : "shared geography";
  const timeJoin = context.timeFields.length
    ? formatFieldList(context.timeFields)
    : "matched date range";
  const propertyJoin = context.propertyFields.length
    ? formatFieldList(context.propertyFields)
    : "property, parcel, or address";
  const institutionJoin = context.institutionFields.length
    ? formatFieldList(context.institutionFields)
    : "institution, agency unit, or operating site";

  const catalog = {
    "acs-renter-demographics": {
      datasetType: "Census or ACS renter, household, income, and demographic tables",
      relevance: `These can supply the missing denominator for the ${context.groupLabelLower} categories or places in this lead.`,
      possibleJoinKey: context.geographyFields.length ? geographyJoin : "zip code, tract, neighborhood, or other shared geography",
      majorLimitation: "ACS estimates may be lagged or too coarse to line up perfectly with the administrative period or the exact case population."
    },
    "acs-housing-baseline": {
      datasetType: "Census or ACS housing-unit, renter, owner, and burden tables",
      relevance: `These can show whether the observed ${context.metricLabelLower} gap is large relative to the underlying housing population.`,
      possibleJoinKey: context.geographyFields.length ? geographyJoin : "shared geography such as tract, zip code, or neighborhood",
      majorLimitation: "They provide baseline context, not direct evidence of what happened in each case or building."
    },
    "education-enrollment": {
      datasetType: "Enrollment and student-demographic datasets",
      relevance: `These can test whether the ${context.metricLabelLower} difference remains after accounting for the size and composition of the affected student groups.`,
      possibleJoinKey: context.institutionFields.length ? institutionJoin : `${geographyJoin} and ${timeJoin}`,
      majorLimitation: "Enrollment files may not line up exactly with the timing, grade span, or subgroup definitions used in the current dataset."
    },
    "acs-demographics": {
      datasetType: "Census or ACS population and demographic baseline tables",
      relevance: `These can help test whether the ${context.groupLabelLower} disparity looks different once population or demographic context is added.`,
      possibleJoinKey: context.geographyFields.length ? geographyJoin : "shared geography and matched period",
      majorLimitation: "Population baselines do not measure exposure to the underlying system, only the surrounding population."
    },
    "health-denominator": {
      datasetType: "Population, patient-volume, or facility-capacity baseline datasets",
      relevance: `These can challenge whether the ${context.metricLabelLower} gap simply reflects who is served or how large each provider is.`,
      possibleJoinKey: context.institutionFields.length ? institutionJoin : `${geographyJoin} and ${timeJoin}`,
      majorLimitation: "Facility or patient counts may not be public at the same level of detail as the current dataset."
    },
    "transportation-exposure": {
      datasetType: "Ridership, traffic-volume, or trip-exposure datasets",
      relevance: `These can test whether the observed ${context.metricLabelLower} difference is still notable once exposure is considered.`,
      possibleJoinKey: context.institutionFields.length ? institutionJoin : `${geographyJoin} and ${timeJoin}`,
      majorLimitation: "Exposure measures often use different collection systems and may not align cleanly with the outcome period."
    },
    "court-records": {
      datasetType: "Housing court or eviction case records",
      relevance: "These can validate whether the same pattern appears in a separate case-management system rather than only in the current administrative dataset.",
      possibleJoinKey: context.propertyFields.length ? propertyJoin : `${geographyJoin} and ${timeJoin}`,
      majorLimitation: "Case records may omit party demographics and can be hard to connect cleanly without property or case identifiers."
    },
    "ownership-parcel": {
      datasetType: "Ownership, parcel, assessor, or deed datasets",
      relevance: "These can test whether a small set of buildings, parcels, or owners accounts for most of the apparent gap.",
      possibleJoinKey: propertyJoin,
      majorLimitation: "Ownership structures can be fragmented, and entity matching may require manual cleanup even when parcel identifiers exist."
    },
    "complaints-inspections": {
      datasetType: contextualComplaintDatasetLabel(context),
      relevance: `These can show whether the same places or groups also stand out in related oversight, complaint, or inspection records.`,
      possibleJoinKey: context.propertyFields.length
        ? propertyJoin
        : context.institutionFields.length
          ? institutionJoin
          : `${geographyJoin} and ${timeJoin}`,
      majorLimitation: "Complaint and inspection systems reflect reporting behavior and enforcement practice, not just the underlying condition."
    },
    "agency-enforcement": {
      datasetType: contextualAgencyDatasetLabel(context),
      relevance: "These can challenge or validate whether the lead survives in a second agency workflow or enforcement record.",
      possibleJoinKey: context.institutionFields.length
        ? institutionJoin
        : context.geographyFields.length
          ? `${geographyJoin} and ${timeJoin}`
          : timeJoin,
      majorLimitation: "A second administrative source may define incidents, actions, or time periods differently from the current dataset."
    },
    "historical-releases": {
      datasetType: "Historical releases of the same dataset",
      relevance: `These can show whether the ${context.metricLabelLower} pattern is stable, emerging, or tied to a short-lived reporting period.`,
      possibleJoinKey: context.timeFields.length ? timeJoin : "same record structure plus archived release date",
      majorLimitation: "Schema changes, backfills, and revisions can make period-to-period comparisons misleading if they are not normalized."
    },
    "district-demographics": {
      datasetType: "District, school, or institution demographic and performance profiles",
      relevance: "These can test whether the lead is concentrated in a few institutions or reflects broader composition differences across them.",
      possibleJoinKey: context.institutionFields.length ? institutionJoin : `${geographyJoin} and ${timeJoin}`,
      majorLimitation: "Institution profiles may aggregate away the subgroup or event-level detail needed to mirror the current lead exactly."
    },
    "policy-context": {
      datasetType: "Policy change timelines, board records, or implementation documents",
      relevance: "These can frame whether the apparent pattern should be checked before and after rule changes or institutional decisions.",
      possibleJoinKey: "time period, agency, institution, or jurisdiction",
      majorLimitation: "Policy documents provide context, but they do not validate the underlying disparity without additional outcome data."
    },
    "peer-benchmark": {
      datasetType: "Peer-jurisdiction, peer-company, or sector benchmark datasets",
      relevance: `These can test whether the observed ${context.metricLabelLower} difference is unusual relative to similar organizations or places.`,
      possibleJoinKey: context.geographyFields.length ? geographyJoin : "organization, institution type, sector, or matched period",
      majorLimitation: "Peer datasets often use different definitions and may support comparison only at a broad level."
    }
  };

  return catalog[key] || null;
}

function contextualComplaintDatasetLabel(context) {
  if (context.domain === "housing") {
    return "Housing complaints, code-violation, or inspection datasets";
  }
  if (context.domain === "policing") {
    return "Civilian complaint, stop review, or use-of-force datasets";
  }
  if (context.domain === "health") {
    return "Inspection, complaint, or sanction datasets";
  }
  return "Complaint, inspection, or oversight datasets";
}

function contextualAgencyDatasetLabel(context) {
  if (context.domain === "policing") {
    return "Calls-for-service, deployment, or enforcement datasets";
  }
  if (context.domain === "health") {
    return "Licensing, sanction, or enforcement datasets";
  }
  if (context.domain === "transportation") {
    return "Service, maintenance, reliability, or enforcement datasets";
  }
  return "Agency enforcement or oversight datasets";
}

function inferDomain(text) {
  let best = { key: "general", score: 0 };

  for (const config of DOMAIN_CONFIGS) {
    const matches = text.match(new RegExp(config.match.source, "ig"));
    const score = matches ? matches.length : 0;
    if (score > best.score) {
      best = { key: config.key, score };
    }
  }

  return best.key;
}

function getDomainConfig(domain) {
  return DOMAIN_CONFIGS.find((config) => config.key === domain) || {
    key: "general",
    datasetFollowUp() {
      return [
        "Historical releases of the same dataset to test whether the pattern persists over time",
        "A related public dataset from another agency or oversight body covering the same issue",
        "Population or denominator tables that put the observed groups into context",
        "Administrative records that capture the same outcome using a different workflow or reporting system"
      ];
    },
    leadFollowUp(context) {
      return [
        `A denominator dataset relevant to ${context.groupLabelLower} categories`,
        `Historical data on ${context.metricLabelLower}`,
        "A second public dataset measuring the same issue from another administrative source",
        "Geographic comparison data for the affected groups or places"
      ];
    },
    interviews: [
      "A subject-matter academic researcher",
      "Community or advocacy groups affected by the issue",
      "A data-methods expert familiar with public administrative records"
    ],
    agencies: [
      "The agency that publishes the dataset",
      "An oversight, audit, or inspector-general office",
      "A public records or performance-management office"
    ],
    records: [
      "Data dictionaries, methodology notes, and change logs",
      "Internal audits or evaluation reports",
      "Policy memos or operating procedures that affect the reported outcomes"
    ],
    cautions: [
      "Administrative datasets often reflect collection rules, program eligibility, and reporting practices rather than the full underlying phenomenon."
    ]
  };
}

function buildDenominatorSuggestion(context) {
  if (context.domain === "housing") {
    return "Renter-household, owner-household, vacancy, or housing-unit denominators for the same places or groups";
  }
  if (context.domain === "education") {
    return "Enrollment denominators for the same schools, grades, or student groups";
  }
  if (context.domain === "policing") {
    return "Population, driving, or calls-for-service denominators for the same places or groups";
  }
  if (context.domain === "health") {
    return "Population, patient-volume, or facility-capacity denominators for the same places or providers";
  }
  if (context.domain === "transportation") {
    return "Ridership, traffic-volume, or route-exposure denominators for the same corridors or groups";
  }
  return "A denominator or exposure dataset showing how common the relevant groups are in the underlying population or case pool";
}

function parseLeadingPercent(text) {
  const match = String(text || "").match(/(\d+(?:\.\d+)?)%/);
  return match ? Number(match[1]) : null;
}

function formatFieldList(fields) {
  const clean = uniqueItems(fields.map(humanize)).filter(Boolean).slice(0, 3);
  if (!clean.length) {
    return "the available fields";
  }
  if (clean.length === 1) {
    return clean[0];
  }
  if (clean.length === 2) {
    return `${clean[0]} and ${clean[1]}`;
  }
  return `${clean[0]}, ${clean[1]}, and ${clean[2]}`;
}

function describeGeographyContext(context) {
  const fields = context.geographyFields || [];
  const placeFields = fields.filter((field) => /(borough|ward|district|county|city|state|zip|tract|block|neighborhood|community[_ ]?area|precinct|beat|region)/i.test(field));
  const addressFields = fields.filter((field) => /(address|street|parcel|location)/i.test(field));

  if (placeFields.length) {
    return `geographies such as ${formatFieldList(placeFields)}`;
  }

  if (addressFields.length) {
    return `address or parcel fields such as ${formatFieldList(addressFields)}`;
  }

  return `geographic fields such as ${formatFieldList(fields)}`;
}

function humanize(value) {
  return String(value || "").replace(/_/g, " ");
}

function uniqueItems(values) {
  return [...new Set(values.filter(Boolean))];
}

function joinPhrases(values) {
  const clean = values.filter(Boolean);
  if (!clean.length) {
    return "additional baseline context";
  }
  if (clean.length === 1) {
    return clean[0];
  }
  if (clean.length === 2) {
    return `${clean[0]} and ${clean[1]}`;
  }
  return `${clean.slice(0, -1).join(", ")}, and ${clean[clean.length - 1]}`;
}

function uniqueObjectsBy(values, key) {
  const seen = new Set();

  return values.filter((value) => {
    const marker = value?.[key];
    if (!marker || seen.has(marker)) {
      return false;
    }
    seen.add(marker);
    return true;
  });
}
