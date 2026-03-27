import { routeBusinessStoryFamily } from "../reporting/business-story-router.mjs";
import { buildBusinessInputProfile } from "../reporting/business-input-profile.mjs";

const MAX_LEADS = 2;
const MIN_GROUP_SIZE = 2;
const MIN_EDITORIAL_SIGNAL_SCORE = 60;
const IDENTIFIER_GROUP_PATTERNS =
  /(^:|(^|_)(zip|zipcode|zip_code|postal|postal_code|fips|census_tract|tract|block|block_group|geoid|district|district_id|school|school_id|facility|facility_id|institution|institution_id|organization|organization_id|company|company_id|campus|campus_id|site|site_id|provider|provider_id|agency|agency_id|precinct|beat|route|station|parcel|property|building)(_|$)|(_id$)|computed_region)/i;
const IGNORED_NUMERIC_PATTERNS =
  /(^:|(^|_)(id|code|key|zip|zipcode|zip_code|postal|postal_code|fips|census_tract|tract|block|block_group|geoid|district_id|school_id|facility_id|institution_id|organization_id|company_id|campus_id|site_id|provider_id|agency_id|precinct|beat|route|station|parcel|property|building|coord|coords|latitude|longitude|lat|lon|x|y|street_number|address_number)(_|$)|(_id$)|computed_region)/i;
const LIKELY_MEASURE_PATTERNS =
  /(avg|average|median|mean|days|hours|minutes|time|count|total|amount|cost|charge|score|rate|ratio|pct|percent|share|index|income|age|requests|cases|violations|inspections|complaints|population|incidents|stops|arre?sts|enrollment|attendance|graduation|mortality|burden|response|unresolved|usage|consumption|kwh|kw|demand|margin|growth|profit|ebitda|cash|cash_flow|liquidity|current_ratio|quick_ratio|leverage|coverage|turnover|yield)/i;
const SUBSTANTIVE_OUTCOME_PATTERNS =
  /(avg|average|median|mean|days|hours|minutes|time|delay|wait|cost|price|fee|score|rate|ratio|pct|percent|share|income|revenue|margin|growth|profit|ebitda|cash|cash_flow|liquidity|current_ratio|quick_ratio|leverage|coverage|requests|cases|violations|inspections|complaints|incidents|stops|arre?sts|attendance|graduation|mortality|burden|response|unresolved|outage|usage|consumption|evict|filing|claim|citation|injury|fatal|denial|approval|turnover|yield|utilization|occupancy|churn|retention)/i;
const DEMOGRAPHIC_GROUP_PATTERNS =
  /(^|_)(race|ethnicity|ethnic|gender|sex|age_group|age_band|income_band|poverty|language|disability|veteran|majority|minority|origin)(_|$)/i;
const DENOMINATOR_PATTERNS =
  /(population|residents|resident|households|household|renter|renters|owner|owners|housing_units|units|unit_count|students|student|enrollment|membership|employees|employee|customer|customers|users|businesses|firms|companies|household_count|capacity|beds|caseload|workload)/i;
const EXPOSURE_PATTERNS =
  /(ridership|traffic|volume|trip|calls_for_service|calls|applications|visits|encounters|admissions|service_area|exposure)/i;
const ADMINISTRATIVE_FIELD_PATTERNS =
  /(^|_)(year|month|quarter|week|fiscal|calendar|latitude|longitude|lat|lon|x|y|district|ward|precinct|beat|tract|block|parcel|address|street|route|station|code|id|number|sequence|order)(_|$)/i;
const GENERIC_COUNT_METRIC_PATTERNS =
  /(^|_)(count|total|number|qty|quantity|sum)(_|$)/i;
const GENERIC_GROUP_PATTERNS =
  /(^|_)(type|category|class|status|flag|group|label)(_|$)/i;
const NUMERIC_CATEGORY_PATTERNS =
  /(^|_)(grade|level|tier|band|quartile|quintile|decile|class|category|status|score_band|income_band|age_group)(_|$)/i;
const QUANTITY_LIKE_PATTERNS =
  /(^|_)(item_quantity|quantity|qty|count|total|number|motors|generators|heaters|fixtures|receptacles|units|beds|volume)(_|$)/i;
const LOW_VALUE_GROUP_PATTERNS =
  /(^|_)(vendor|firm|meter|account|status|type|class|source|funding_source|filing_status|job_status|reporting_status|amr|expiration|manufacturer)(_|$)/i;
const BUSINESS_CODE_GROUP_PATTERNS =
  /(^|_)(ticker|issuer|company|company_name|peer|competitor|sector|industry|segment|division|product|brand|channel|market|region|customer_cohort|cohort)(_|$)/i;
const LOW_VALUE_METRIC_PATTERNS =
  /(^|_)(job_number|license_number|house_number|street_number|lot|bin|community_board|board|reference|serial|sequence|order|item_|sign_|account_number|meter_number)(_|$)|^(tds|edp)$/i;
const DEMOGRAPHIC_COUNT_PATTERNS =
  /(^|_)(race|ethnicity|gender|sex|age|income|poverty|language|disability|veteran|student|resident|household|population|renter|owner)(_|$).*(count|total|number|population|students|residents|households)?/i;
const ADMINISTRATIVE_COUNT_PATTERNS =
  /(^|_)(record|permit|filing|application|submission|entry|job|license|inspection_id|complaint_id|case_id|meter|account|vendor|firm|board|bin|lot)(_|$).*(count|total|number|qty|quantity)?/i;
const SUBSTANTIVE_COUNT_PATTERNS =
  /(^|_)(complaints|violations|requests|incidents|stops|arrests|evictions|filings|cases|claims|citations|outages|injuries|deaths|fatalities|denials|approvals)(_|$)/i;
const GEOGRAPHIC_PATTERNS =
  /((^|_)(borough|ward|district|county|city|state|zip|postal|tract|block|neighborhood|community_area|precinct|beat|region|address|street|school|campus|facility|site|location|lat|lon|latitude|longitude)(_|$))/i;
const GEOGRAPHIC_GROUP_PATTERNS =
  /((^|_)(borough|ward|district|county|city|state|zip|postal|tract|block|neighborhood|community_area|precinct|beat|region)(_|$))/i;
const TIME_PATTERNS =
  /((^|_)(date|year|month|quarter|week|period|fiscal|calendar|season|term|timestamp|created|updated|modified)(_|$)|(_at$))/i;

export function analyzeCsvText(csvText, filename = "dataset.csv") {
  const { headers, records, profile, auxiliaryColumns } = readCsvDataset(csvText);
  const businessInputProfile = buildBusinessInputProfile({
    headers,
    detectedColumns: {
      groupColumns: profile.groupColumns,
      metricColumns: profile.metricColumns,
      timeColumns: auxiliaryColumns.timeColumns
    },
    auxiliaryColumns
  });

  if (records.length < 4) {
    throw new Error("CSV must include at least 4 non-empty rows for disparity analysis.");
  }

  if (!profile.groupColumns.length) {
    throw new Error("No usable group columns found. Include at least one categorical column with repeated group values.");
  }
  if (!profile.metricColumns.length) {
    throw new Error("No usable numeric metric columns found. Include at least one numeric outcome column.");
  }

  const candidates = buildLeadCandidates(records, profile, auxiliaryColumns);
  if (!candidates.length) {
    throw new Error("No business-reporting hypotheses fit the current CSV structure.");
  }

  const leads = candidates
    .sort((left, right) => right.score - left.score)
    .slice(0, MAX_LEADS)
    .map((candidate, index) => formatLead(candidate, index + 1));

  return {
    dataset: {
      filename,
      rowCount: records.length,
      columnCount: headers.length
    },
    analysisFocus: "Business-reporting hypothesis detection across company, market, segment, and financial metrics.",
    businessInputProfile,
    detectedColumns: {
      groupColumns: profile.groupColumns,
      metricColumns: profile.metricColumns,
      geographicColumns: auxiliaryColumns.geographicColumns,
      timeColumns: auxiliaryColumns.timeColumns
    },
    leads
  };
}

export function inspectCsvText(csvText, filename = "dataset.csv") {
  const { headers, records, profile, auxiliaryColumns } = readCsvDataset(csvText);
  const missingness = computeMissingness(records, headers);
  const limitations = buildQualityLimitations({ rowCount: records.length, headers, profile, missingness });
  const businessInputProfile = buildBusinessInputProfile({
    headers,
    detectedColumns: {
      groupColumns: profile.groupColumns,
      metricColumns: profile.metricColumns,
      timeColumns: auxiliaryColumns.timeColumns
    },
    auxiliaryColumns
  });

  return {
    dataset: {
      filename,
      rowCount: records.length,
      columnCount: headers.length
    },
    likelyGroupColumns: profile.groupColumns,
    likelyMetricColumns: profile.metricColumns,
    likelyGeographicColumns: auxiliaryColumns.geographicColumns,
    likelyTimeColumns: auxiliaryColumns.timeColumns,
    businessInputProfile,
    missingness,
    limitations
  };
}

export function parseAnalysisDataset(csvText, filename = "dataset.csv") {
  const { headers, records, profile, auxiliaryColumns } = readCsvDataset(csvText);
  const businessInputProfile = buildBusinessInputProfile({
    headers,
    detectedColumns: {
      groupColumns: profile.groupColumns,
      metricColumns: profile.metricColumns,
      timeColumns: auxiliaryColumns.timeColumns
    },
    auxiliaryColumns
  });

  return {
    dataset: {
      filename,
      rowCount: records.length,
      columnCount: headers.length
    },
    headers,
    records,
    businessInputProfile,
    detectedColumns: {
      groupColumns: profile.groupColumns,
      metricColumns: profile.metricColumns,
      geographicColumns: auxiliaryColumns.geographicColumns,
      timeColumns: auxiliaryColumns.timeColumns
    }
  };
}

export function summarizeRecordsByGroup(records, groupColumn, metricColumn) {
  return summarizeByGroup(records, groupColumn, metricColumn);
}

function buildLeadCandidates(records, profile, auxiliaryColumns) {
  const candidates = [];

  for (const groupColumn of profile.groupColumns) {
    for (const metricColumn of profile.metricColumns) {
      const grouped = summarizeByGroup(records, groupColumn, metricColumn);
      if (grouped.groups.length < 2) {
        continue;
      }

      const groupProfile = profile.fieldProfiles[groupColumn];
      const metricProfile = profile.fieldProfiles[metricColumn];
      const pairAssessment = assessFieldPair({
        groupColumn,
        metricColumn,
        grouped,
        groupProfile,
        metricProfile
      });
      if (!pairAssessment.isMeaningful) {
        continue;
      }

      const strongest = grouped.groups[grouped.groups.length - 1];
      const weakest = grouped.groups[0];
      const absDiff = strongest.mean - weakest.mean;
      const overallMean = grouped.overallMean || 0;
      const relativeDiff = Math.abs(absDiff) / Math.max(Math.abs(overallMean), 1);
      const ratio = weakest.mean > 0 ? strongest.mean / weakest.mean : null;

      if (relativeDiff < 0.18 && (!ratio || ratio < 1.2)) {
        continue;
      }

      const balanceScore = Math.min(strongest.count, weakest.count) / Math.max(strongest.count, weakest.count);
      const coverageScore = Math.min(grouped.totalCount / 12, 1);
      const strongestDirection = inferDirection(metricColumn, absDiff);
      const businessStory = routeBusinessStoryFamily({
        groupColumn,
        metricColumn,
        groupProfile,
        metricProfile,
        strongest,
        weakest,
        direction: strongestDirection,
        auxiliaryColumns,
        allColumns: Object.keys(profile.fieldProfiles || {})
      });
      if (!businessStory) {
        continue;
      }
      const baseScore = relativeDiff * 60 + balanceScore * 20 + coverageScore * 20;
      const score = baseScore + pairAssessment.scoreAdjustment + businessStory.scoreAdjustment;
      if (score < MIN_EDITORIAL_SIGNAL_SCORE) {
        continue;
      }

      candidates.push({
        groupColumn,
        metricColumn,
        groupProfile,
        metricProfile,
        grouped,
        strongest,
        weakest,
        absDiff,
        relativeDiff,
        ratio,
        score,
        pairAssessment,
        strongestDirection,
        businessStory
      });
    }
  }

  return dedupeCandidates(candidates);
}

function dedupeCandidates(candidates) {
  const seen = new Set();
  return candidates.filter((candidate) => {
    const key = `${candidate.groupColumn}:${candidate.metricColumn}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function summarizeByGroup(records, groupColumn, metricColumn) {
  const summaries = new Map();
  let total = 0;
  let totalCount = 0;

  for (const record of records) {
    const groupValue = normalizeGroupValue(record[groupColumn]);
    const rawMetric = record[metricColumn];
    const metricValue = toNumber(rawMetric);

    if (!groupValue || Number.isNaN(metricValue)) {
      continue;
    }

    if (!summaries.has(groupValue)) {
      summaries.set(groupValue, { value: groupValue, count: 0, total: 0, values: [] });
    }

    const summary = summaries.get(groupValue);
    summary.count += 1;
    summary.total += metricValue;
    summary.values.push(metricValue);
    total += metricValue;
    totalCount += 1;
  }

  const groups = [...summaries.values()]
    .filter((summary) => summary.count >= MIN_GROUP_SIZE)
    .map((summary) => ({
      value: summary.value,
      count: summary.count,
      mean: summary.total / summary.count,
      min: Math.min(...summary.values),
      max: Math.max(...summary.values)
    }))
    .sort((left, right) => left.mean - right.mean);

  return {
    totalCount,
    overallMean: totalCount ? total / totalCount : 0,
    groups
  };
}

function formatLead(candidate, rank) {
  const groupLabel = humanizeColumn(candidate.groupColumn);
  const metricLabel = humanizeColumn(candidate.metricColumn);
  const strongestDirection = candidate.strongestDirection || inferDirection(candidate.metricColumn, candidate.absDiff);
  const ratioText = candidate.ratio ? `${candidate.ratio.toFixed(2)}x` : `${Math.abs(candidate.absDiff).toFixed(1)} point gap`;
  const strongestValue = formatNumber(candidate.strongest.mean);
  const weakestValue = formatNumber(candidate.weakest.mean);
  const promiseScore = Math.min(99, Math.round(candidate.score));
  const businessStory = candidate.businessStory || {};
  const headline = businessStory.headline || buildLeadHeadline(candidate, groupLabel, metricLabel);
  const hypothesis = businessStory.hypothesis || buildLeadHypothesis(candidate, metricLabel, strongestDirection);
  const whyItMayMatter = businessStory.whyItMayMatter || buildLeadImportance(candidate, groupLabel, metricLabel);
  const possibleWeaknesses = businessStory.possibleWeaknesses || buildLeadWeaknesses(candidate);
  const moreDataNeeded = businessStory.moreDataNeeded || buildLeadDataNeeds(candidate);
  const whoToInterview =
    businessStory.whoToInterview || suggestInterviews(candidate.groupColumn, candidate.metricColumn);
  const editorialQuality =
    businessStory.family && promiseScore >= 75 ? "strong" : candidate.pairAssessment.qualityLabel;

  return {
    rank,
    promiseScore,
    headline,
    hypothesis,
    patternFound: `${candidate.strongest.value} averages ${strongestValue} on ${metricLabel.toLowerCase()}, versus ${weakestValue} for ${candidate.weakest.value}. The estimated gap is ${ratioText} across ${candidate.grouped.totalCount} usable rows.`,
    whyItMayMatter,
    possibleWeaknesses,
    moreDataNeeded,
    whoToInterview,
    editorialAssessment: {
      quality: editorialQuality,
      rationale: `${candidate.pairAssessment.rationale}; routed to ${candidate.businessStory?.family || "business"}`
    },
    storyFamily: candidate.businessStory?.family || null,
    comparison: {
      groupColumn: candidate.groupColumn,
      metricColumn: candidate.metricColumn,
      highestGroup: candidate.strongest.value,
      lowestGroup: candidate.weakest.value
    }
  };
}

function suggestInterviews(groupColumn, metricColumn) {
  const groupLabel = humanizeColumn(groupColumn).toLowerCase();
  const metricLabel = humanizeColumn(metricColumn).toLowerCase();

  return [
    `Agency staff responsible for the ${metricLabel} data and methodology`,
    `Community advocates or residents from the highest- and lowest-performing ${groupLabel} groups`,
    `An academic or policy researcher who studies disparities in this service area`
  ];
}

function inferColumns(records, headers) {
  const groupColumns = [];
  const metricColumns = [];
  const fieldProfiles = {};

  for (const header of headers) {
    const values = records.map((record) => record[header]).filter((value) => value !== "");
    if (!values.length) {
      continue;
    }

    const profile = buildFieldProfile(header, values);
    fieldProfiles[header] = profile;

    if (profile.canGroup) {
      groupColumns.push(header);
    }

    if (profile.canMetric) {
      metricColumns.push(header);
    }
  }

  return { groupColumns, metricColumns, fieldProfiles };
}

function isIdentifierLikeGroupColumn(header, valueCount, uniqueCount, uniqueRatio) {
  if (!IDENTIFIER_GROUP_PATTERNS.test(header) && !GEOGRAPHIC_GROUP_PATTERNS.test(header)) {
    return false;
  }

  return uniqueCount >= 2 && uniqueCount <= Math.min(valueCount - 1, 80) && uniqueRatio <= 0.95;
}

function buildFieldProfile(header, values) {
  const numericValues = values.map(toNumber).filter((value) => !Number.isNaN(value));
  const uniqueCount = new Set(values).size;
  const uniqueRatio = uniqueCount / values.length;
  const numericShare = numericValues.length / values.length;
  const codeLikeShare = values.filter(isCodeLikeValue).length / values.length;
  const plainLanguageShare = values.filter(isPlainLanguageValue).length / values.length;
  const semanticType = classifyFieldSemanticType(header, numericShare);
  const isIdentifierGroup = isIdentifierLikeGroupColumn(header, values.length, uniqueCount, uniqueRatio);

  const canGroup =
    isIdentifierGroup ||
    (numericShare >= 0.9 &&
      uniqueCount >= 2 &&
      uniqueCount <= 12 &&
      uniqueRatio <= 0.4 &&
      NUMERIC_CATEGORY_PATTERNS.test(header) &&
      !["denominator", "exposure", "administrative", "time", "substantive_outcome"].includes(semanticType)) ||
    (numericShare < 0.5 &&
      uniqueCount >= 2 &&
      uniqueCount <= 8 &&
      uniqueRatio <= 0.7 &&
      !["denominator", "exposure", "administrative", "time", "substantive_outcome"].includes(semanticType));

  const canMetric =
    numericShare >= 0.9 &&
    uniqueCount >= 3 &&
    !IGNORED_NUMERIC_PATTERNS.test(header) &&
    !["identifier", "geography", "entity", "demographic_category", "denominator", "exposure", "administrative", "time"].includes(semanticType) &&
    !(uniqueRatio > 0.95 && !LIKELY_MEASURE_PATTERNS.test(header));

  return {
    header,
    uniqueCount,
    uniqueRatio,
    numericShare,
    codeLikeShare,
    plainLanguageShare,
    semanticType,
    canGroup,
    canMetric,
    genericGroup: GENERIC_GROUP_PATTERNS.test(header),
    genericCountMetric: GENERIC_COUNT_METRIC_PATTERNS.test(header),
    opaqueAbbreviation: isOpaqueAbbreviation(header),
    quantityLike: QUANTITY_LIKE_PATTERNS.test(header),
    lowValueGroup: LOW_VALUE_GROUP_PATTERNS.test(header),
    lowValueMetric: LOW_VALUE_METRIC_PATTERNS.test(header)
  };
}

function classifyFieldSemanticType(header, numericShare) {
  if (TIME_PATTERNS.test(header)) {
    return "time";
  }
  if (isGeographicField(header)) {
    return "geography";
  }
  if (isEntityIdentifier(header)) {
    return "entity";
  }
  if (IDENTIFIER_GROUP_PATTERNS.test(header) || /(^|_)(id|code|key)(_|$)/i.test(header)) {
    return "identifier";
  }
  if (DEMOGRAPHIC_GROUP_PATTERNS.test(header)) {
    return "demographic_category";
  }
  if (numericShare >= 0.9 && DEMOGRAPHIC_COUNT_PATTERNS.test(header)) {
    return "demographic_count";
  }
  if (DENOMINATOR_PATTERNS.test(header)) {
    return "denominator";
  }
  if (EXPOSURE_PATTERNS.test(header)) {
    return "exposure";
  }
  if (numericShare >= 0.9 && ADMINISTRATIVE_COUNT_PATTERNS.test(header)) {
    return "administrative_count";
  }
  if (ADMINISTRATIVE_FIELD_PATTERNS.test(header) || IGNORED_NUMERIC_PATTERNS.test(header)) {
    return "administrative";
  }
  if (numericShare >= 0.9 && SUBSTANTIVE_OUTCOME_PATTERNS.test(header)) {
    return "substantive_outcome";
  }
  if (numericShare >= 0.9 && SUBSTANTIVE_COUNT_PATTERNS.test(header)) {
    return "substantive_outcome";
  }
  if (numericShare >= 0.9 && GENERIC_COUNT_METRIC_PATTERNS.test(header)) {
    return "generic_count";
  }
  if (numericShare >= 0.9 && LIKELY_MEASURE_PATTERNS.test(header)) {
    return "numeric_measure";
  }
  return "categorical";
}

function isGeographicField(header) {
  return GEOGRAPHIC_GROUP_PATTERNS.test(header) || /(^|_)(zip|zipcode|zip_code|postal|postal_code|fips|tract|block|geoid|borough|ward|county|city|state|neighborhood|community_area|precinct|beat|region)(_|$)/i.test(header);
}

function isEntityIdentifier(header) {
  return /(^|_)(school|facility|institution|organization|company|campus|site|provider|agency|station|route|parcel|property|building)(_|$)/i.test(header);
}

function assessFieldPair({ groupColumn, metricColumn, grouped, groupProfile = {}, metricProfile = {} }) {
  let scoreAdjustment = 0;
  const reasons = [];

  if (!groupProfile.canGroup || !metricProfile.canMetric) {
    return {
      isMeaningful: false,
      scoreAdjustment,
      rationale: "The field pairing is not structurally suitable for disparity analysis.",
      qualityLabel: "suppressed"
    };
  }

  if (["identifier", "administrative", "time", "denominator", "exposure"].includes(groupProfile.semanticType) && groupProfile.semanticType !== "geography" && groupProfile.semanticType !== "entity") {
    return {
      isMeaningful: false,
      scoreAdjustment,
      rationale: "The grouping field looks administrative rather than editorially meaningful.",
      qualityLabel: "suppressed"
    };
  }

  if (!["substantive_outcome", "numeric_measure"].includes(metricProfile.semanticType)) {
    return {
      isMeaningful: false,
      scoreAdjustment,
      rationale: "The metric does not look like a substantive outcome.",
      qualityLabel: "suppressed"
    };
  }

  if (
    groupProfile.genericGroup &&
    !["demographic_category", "geography", "entity"].includes(groupProfile.semanticType)
  ) {
    return {
      isMeaningful: false,
      scoreAdjustment,
      rationale: "The grouping field looks too generic to form a useful newsroom hypothesis.",
      qualityLabel: "suppressed"
    };
  }

  if (groupProfile.lowValueGroup) {
    return {
      isMeaningful: false,
      scoreAdjustment,
      rationale: "The grouping field looks operational or technical rather than newsroom-relevant.",
      qualityLabel: "suppressed"
    };
  }

  if (groupProfile.quantityLike && groupProfile.semanticType !== "demographic_category") {
    return {
      isMeaningful: false,
      scoreAdjustment,
      rationale: "The grouping field looks like a quantity or slice count rather than a reporting dimension.",
      qualityLabel: "suppressed"
    };
  }

  if (
    groupProfile.codeLikeShare >= 0.8 &&
    groupProfile.plainLanguageShare < 0.3 &&
    !BUSINESS_CODE_GROUP_PATTERNS.test(groupColumn) &&
    !["geography", "entity", "demographic_category"].includes(groupProfile.semanticType)
  ) {
    return {
      isMeaningful: false,
      scoreAdjustment,
      rationale: "The grouping values look like operational codes rather than journalistically useful categories.",
      qualityLabel: "suppressed"
    };
  }

  if (metricProfile.lowValueMetric) {
    return {
      isMeaningful: false,
      scoreAdjustment,
      rationale: "The metric looks like an identifier or technical schema field rather than a reportable outcome.",
      qualityLabel: "suppressed"
    };
  }

  if (["denominator", "exposure", "administrative", "time"].includes(metricProfile.semanticType)) {
    return {
      isMeaningful: false,
      scoreAdjustment,
      rationale: "The metric looks more like context or administration than an interpretable outcome.",
      qualityLabel: "suppressed"
    };
  }

  if (metricProfile.opaqueAbbreviation) {
    return {
      isMeaningful: false,
      scoreAdjustment,
      rationale: "The metric label is too opaque to surface as a newsroom-facing hypothesis.",
      qualityLabel: "suppressed"
    };
  }

  if (["administrative_count", "demographic_count", "generic_count"].includes(metricProfile.semanticType)) {
    return {
      isMeaningful: false,
      scoreAdjustment,
      rationale: "The metric looks like a count or baseline field rather than a substantive outcome.",
      qualityLabel: "suppressed"
    };
  }

  if (groupProfile.semanticType === "demographic_category") {
    scoreAdjustment += 12;
    reasons.push("meaningful demographic grouping");
  } else if (groupProfile.semanticType === "geography") {
    scoreAdjustment += 10;
    reasons.push("clear place-based grouping");
  } else if (groupProfile.semanticType === "entity") {
    scoreAdjustment += 8;
    reasons.push("clear institution or facility grouping");
  } else {
    scoreAdjustment += 3;
  }

  if (metricProfile.semanticType === "substantive_outcome") {
    scoreAdjustment += 12;
    reasons.push("interpretable outcome metric");
  } else {
    scoreAdjustment += 5;
  }

  if (groupProfile.genericGroup) {
    scoreAdjustment -= 6;
    reasons.push("generic grouping label");
  }

  if (metricProfile.genericCountMetric && !SUBSTANTIVE_OUTCOME_PATTERNS.test(metricColumn)) {
    scoreAdjustment -= 12;
    reasons.push("generic count metric without clear substantive meaning");
  }

  if (grouped.groups.length < 3) {
    scoreAdjustment -= 4;
    reasons.push("very few comparison groups");
  }

  if (Math.min(...grouped.groups.map((group) => group.count)) < 3) {
    scoreAdjustment -= 3;
    reasons.push("thin group counts");
  }

  const qualityLabel =
    scoreAdjustment >= 18 ? "strong" : scoreAdjustment >= 10 ? "usable" : "tentative";

  return {
    isMeaningful: scoreAdjustment >= 2,
    scoreAdjustment,
    rationale: reasons.join("; ") || "Structurally suitable for disparity analysis.",
    qualityLabel
  };
}

function computeMissingness(records, headers) {
  const missingByColumn = headers.map((header) => {
    const missingCount = records.reduce((count, record) => count + (String(record[header] || "").trim() === "" ? 1 : 0), 0);
    return {
      column: header,
      missingCount,
      missingPercent: records.length ? (missingCount / records.length) * 100 : 0
    };
  });

  const totalCells = records.length * headers.length;
  const totalMissing = missingByColumn.reduce((sum, column) => sum + column.missingCount, 0);

  return {
    totalMissingPercent: totalCells ? (totalMissing / totalCells) * 100 : 0,
    columnsWithHighMissingness: missingByColumn.filter((column) => column.missingPercent >= 25).slice(0, 5)
  };
}

function buildQualityLimitations({ rowCount, headers, profile, missingness }) {
  const limitations = [];

  if (rowCount < 25) {
    limitations.push("Very small row count in the sampled data.");
  }
  if (!profile.groupColumns.length) {
    limitations.push("No likely group columns were detected.");
  }
  if (!profile.metricColumns.length) {
    limitations.push("No likely numeric metric columns were detected.");
  }
  if (missingness.totalMissingPercent >= 20) {
    limitations.push("Sampled data shows substantial overall missingness.");
  }
  if (headers.length > 40) {
    limitations.push("Wide schema may require manual column selection before analysis.");
  }

  return limitations;
}

function parseCsv(csvText) {
  const rows = [];
  let currentCell = "";
  let currentRow = [];
  let inQuotes = false;

  for (let index = 0; index < csvText.length; index += 1) {
    const char = csvText[index];
    const next = csvText[index + 1];

    if (char === "\"") {
      if (inQuotes && next === "\"") {
        currentCell += "\"";
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      currentRow.push(currentCell);
      if (!currentRow.every((cell) => cell.trim() === "")) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  if (currentCell.length || currentRow.length) {
    currentRow.push(currentCell);
    if (!currentRow.every((cell) => cell.trim() === "")) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function rowToRecord(headers, row) {
  return headers.reduce((record, header, index) => {
    record[header] = (row[index] || "").trim();
    return record;
  }, {});
}

function readCsvDataset(csvText) {
  const rows = parseCsv(csvText);
  if (rows.length < 2) {
    throw new Error("CSV must include a header row and at least one data row.");
  }

  const headers = rows[0].map((header) => sanitizeHeader(header));
  const records = rows.slice(1).map((row) => rowToRecord(headers, row)).filter(hasAnyValue);
  const profile = inferColumns(records, headers);
  const auxiliaryColumns = inferAuxiliaryColumns(headers);

  return { headers, records, profile, auxiliaryColumns };
}

function inferAuxiliaryColumns(headers) {
  return {
    geographicColumns: headers.filter((header) => GEOGRAPHIC_PATTERNS.test(header)).slice(0, 8),
    timeColumns: headers.filter((header) => TIME_PATTERNS.test(header)).slice(0, 8)
  };
}

function sanitizeHeader(header) {
  return header.trim().replace(/\s+/g, "_");
}

function humanizeColumn(column) {
  return column.replace(/_/g, " ");
}

function hasAnyValue(record) {
  return Object.values(record).some((value) => value !== "");
}

function normalizeGroupValue(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value) {
  const normalized = typeof value === "string" ? value.replace(/[$,%]/g, "").replace(/,/g, "") : value;
  return Number(normalized);
}

function inferDirection(metricColumn, diff) {
  const lowerIsBetter = /(days|delay|wait|unresolved|overdue|rate|complaint|violation|error|denied)/i.test(metricColumn);
  if (lowerIsBetter) {
    return diff > 0 ? "worse" : "better";
  }
  return diff > 0 ? "higher" : "lower";
}

function buildLeadHeadline(candidate, groupLabel, metricLabel) {
  const groupType = candidate.groupProfile?.semanticType;
  const issueLabel = describeIssueLabel(candidate.metricColumn);
  const groupDimension = describeGroupDimension(candidate.groupColumn, candidate.groupProfile);

  if (groupType === "geography") {
    return `${capitalize(issueLabel)} may be uneven across ${groupDimension}`;
  }
  if (groupType === "demographic_category") {
    return `${capitalize(issueLabel)} may differ across ${groupDimension}`;
  }
  if (groupType === "entity") {
    return `${capitalize(issueLabel)} may be concentrated in some ${groupDimension}`;
  }
  return `Possible gap in ${issueLabel} across ${groupDimension}`;
}

function buildLeadHypothesis(candidate, metricLabel, strongestDirection) {
  const issueLabel = describeIssueLabel(candidate.metricColumn);
  const comparativeLanguage = describeComparativeIssue(candidate.metricColumn, strongestDirection, issueLabel);
  return `Preview data suggests ${comparativeLanguage} in ${describeGroupValue(candidate.groupColumn, candidate.strongest.value)} than in ${describeGroupValue(candidate.groupColumn, candidate.weakest.value)}.`;
}

function buildLeadImportance(candidate, groupLabel, metricLabel) {
  const groupType = candidate.groupProfile?.semanticType;
  const issueLabel = describeIssueLabel(candidate.metricColumn);
  const groupDimension = describeGroupDimension(candidate.groupColumn, candidate.groupProfile);

  if (groupType === "geography") {
    return `If this pattern holds in fuller data, it could point reporters toward uneven ${issueLabel} across ${groupDimension}, not just isolated cases.`;
  }
  if (groupType === "demographic_category") {
    return `If this pattern holds up, it could point reporters toward uneven ${issueLabel} across ${groupDimension}.`;
  }
  if (groupType === "entity") {
    return `If this pattern persists, it could suggest ${issueLabel} is concentrated in certain ${groupDimension} rather than spread evenly across the system.`;
  }
  return `If this pattern holds in the larger dataset, it could indicate a meaningful gap in ${issueLabel} across ${groupDimension}.`;
}

function buildLeadWeaknesses(candidate) {
  const weakPoints = [
    "The analysis is descriptive and should not be read as causal.",
    candidate.groupProfile?.semanticType === "entity"
      ? "A small number of institutions or facilities may drive the difference."
      : null,
    candidate.metricProfile?.genericCountMetric
      ? "A raw count can be misleading without denominator or exposure context."
      : null,
    "Differences in case mix, reporting behavior, geography, sample size, or missing records could explain the gap."
  ].filter(Boolean);

  return weakPoints.join(" ");
}

function buildLeadDataNeeds(candidate) {
  const needs = [
    "a larger time series",
    "underlying case-level records",
    candidate.metricProfile?.genericCountMetric ? "a denominator or exposure baseline" : null,
    candidate.groupProfile?.semanticType === "geography" ? "geographic benchmark data" : null,
    candidate.groupProfile?.semanticType === "entity" ? "institution-level comparison fields" : null,
    "documentation on field definitions and coverage"
  ].filter(Boolean);

  return `Before advancing this lead, obtain ${needs.join(", ")}.`;
}

function describeGroupValue(groupColumn, value) {
  if (/zip|zipcode|zip_code|postal/i.test(groupColumn)) {
    return `ZIP code ${value}`;
  }
  if (/tract/i.test(groupColumn)) {
    return `census tract ${value}`;
  }
  if (/block/i.test(groupColumn)) {
    return `block group ${value}`;
  }
  if (/district/i.test(groupColumn)) {
    return `district ${value}`;
  }
  if (/precinct|beat/i.test(groupColumn)) {
    return `${humanizeColumn(groupColumn).toLowerCase()} ${value}`;
  }
  if (/school|facility|site|provider|agency|company|organization|campus|property|building/i.test(groupColumn)) {
    return `${humanizeColumn(groupColumn).toLowerCase()} ${value}`;
  }
  return String(value);
}

function describeIssueLabel(metricColumn) {
  const label = humanizeColumn(metricColumn).toLowerCase();

  if (/response|wait|delay|days|hours|minutes|time/i.test(metricColumn)) {
    return "response times";
  }
  if (/unresolved|overdue/i.test(metricColumn)) {
    return "unresolved case rates";
  }
  if (/complaint/i.test(metricColumn)) {
    return "complaint levels";
  }
  if (/violation/i.test(metricColumn)) {
    return "violation levels";
  }
  if (/inspection/i.test(metricColumn)) {
    return "inspection outcomes";
  }
  if (/request/i.test(metricColumn)) {
    return "service request levels";
  }
  if (/consumption_kwh|kwh|usage/i.test(metricColumn)) {
    return "electricity use";
  }
  if (/consumption_kw|peak_kw|demand/i.test(metricColumn)) {
    return "peak electricity demand";
  }
  if (/cost|charge|price|fee/i.test(metricColumn)) {
    return "cost burdens";
  }
  if (/attendance/i.test(metricColumn)) {
    return "attendance rates";
  }
  if (/graduation/i.test(metricColumn)) {
    return "graduation rates";
  }
  if (/mortality|fatal/i.test(metricColumn)) {
    return "mortality rates";
  }
  if (/income|earnings|salary|wage/i.test(metricColumn)) {
    return "income levels";
  }
  if (/case|filing|claim|citation|arrest|stop|incident/i.test(metricColumn)) {
    return `${label} levels`;
  }
  return label;
}

function describeGroupDimension(groupColumn, groupProfile = {}) {
  if (/zip|zipcode|zip_code|postal/i.test(groupColumn)) {
    return "ZIP codes";
  }
  if (/borough/i.test(groupColumn)) {
    return "boroughs";
  }
  if (/county/i.test(groupColumn)) {
    return "counties";
  }
  if (/city/i.test(groupColumn)) {
    return "cities";
  }
  if (/state/i.test(groupColumn)) {
    return "states";
  }
  if (/neighborhood|community_area/i.test(groupColumn)) {
    return "neighborhoods";
  }
  if (/race|ethnicity|majority|minority/i.test(groupColumn)) {
    return "racial or ethnic groups";
  }
  if (/gender|sex/i.test(groupColumn)) {
    return "gender groups";
  }
  if (/age_group|age_band/i.test(groupColumn)) {
    return "age groups";
  }
  if (/income_band/i.test(groupColumn)) {
    return "income bands";
  }
  if (/school/i.test(groupColumn)) {
    return "schools";
  }
  if (/facility|site/i.test(groupColumn)) {
    return "facilities";
  }
  if (/provider/i.test(groupColumn)) {
    return "providers";
  }
  if (/agency/i.test(groupColumn)) {
    return "agency units";
  }
  if (/district/i.test(groupColumn)) {
    return "districts";
  }
  if (groupProfile.semanticType === "entity") {
    return `${humanizeColumn(groupColumn).toLowerCase()} groups`;
  }
  if (groupProfile.semanticType === "demographic_category") {
    return `${humanizeColumn(groupColumn).toLowerCase()} groups`;
  }
  return `${humanizeColumn(groupColumn).toLowerCase()} groups`;
}

function describeComparativeIssue(metricColumn, strongestDirection, issueLabel) {
  if (/response|wait|delay|days|hours|minutes|time/i.test(metricColumn)) {
    return strongestDirection === "worse" ? `slower ${issueLabel}` : `faster ${issueLabel}`;
  }
  if (/unresolved|overdue|complaint|violation|mortality|fatal/i.test(metricColumn)) {
    return strongerComparator(strongestDirection, `higher ${issueLabel}`, `lower ${issueLabel}`);
  }
  return strongerComparator(strongestDirection, `higher ${issueLabel}`, `lower ${issueLabel}`);
}

function strongerComparator(direction, highText, lowText) {
  return direction === "lower" || direction === "better" ? lowText : highText;
}

function isOpaqueAbbreviation(header) {
  const cleaned = String(header || "").replace(/_/g, "");
  if (cleaned.length > 4) {
    return false;
  }
  if (/[0-9]/.test(cleaned)) {
    return false;
  }
  return /^[a-z]+$/i.test(cleaned) && !SUBSTANTIVE_OUTCOME_PATTERNS.test(header) && !LIKELY_MEASURE_PATTERNS.test(header);
}

function capitalize(value) {
  const text = String(value || "");
  return text ? `${text[0].toUpperCase()}${text.slice(1)}` : text;
}

function isCodeLikeValue(value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  return (
    /^[A-Z0-9/_-]{3,}$/.test(text) ||
    /^[A-Z]{2,}\d{2,}$/.test(text) ||
    /^[A-Z]+\/[A-Z0-9/_-]+$/.test(text)
  );
}

function isPlainLanguageValue(value) {
  const text = String(value || "").trim();
  if (!text) {
    return false;
  }
  return /[a-z]/i.test(text) && /[\s&]/.test(text);
}

function formatNumber(value) {
  if (Math.abs(value) >= 100) {
    return value.toFixed(0);
  }
  if (Math.abs(value) >= 10) {
    return value.toFixed(1);
  }
  return value.toFixed(2);
}
