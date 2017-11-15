/**
 * Take in results data and turn into a useful,
 * json file.
 */

// Dependencies
const fs = require('fs');
const path = require('path');
const csv = require('fast-csv');
const _ = require('lodash');

// yargs converts numbers by default, so we have to be explicit
const argv = require('yargs').option('proxy-contest', {
  alias: 'v',
  type: 'string',
  default: '0101'
}).argv;

// Get stdin
process.stdin.resume();
process.stdin.setEncoding('utf8');

// Proxy contest
let proxyContest = argv['proxy-contest'] || '0101';
let proxyContestNote = false;

// CSV options
let csvOptions = {
  delimiter: ';',
  quote: '',
  headers: [
    'state',
    'county',
    'precinct',
    'contest',
    'contestName',
    'district',
    'candidate',
    'candidateName',
    'suffix',
    'incumbent',
    'party',
    'precincts',
    'totalPrecincts',
    'votes',
    'percent',
    'totalVotes'
  ],
  ignoreEmpty: true,
  trim: true
};
if (argv.type === 'legacy') {
  csvOptions = {
    headers: true,
    ignoreEmpty: true,
    trim: true
  };
}

// Setup csv parser
let parser = csv(csvOptions);

// Collected
let collected = {
  proxy: [],
  senate: [],
  house: [],
  congress: []
};

// Pipe through CSV
console.error('Reading and parsing input...');
process.stdin
  .pipe(parser)
  .on('error', error => {
    console.error(error);
    process.exit(1);
  })
  .on('data', argv.type === 'legacy' ? parseInputLegacy : parseInput)
  .on('end', () => {
    processCollected(collected);
  });

// Parse regular
function parseInput(data) {
  // Parse some values/numbers
  ['precincts', 'totalPrecincts', 'votes', 'totalVotes'].forEach(p => {
    data[p] = parseInt(data[p], 10);
  });
  ['percent'].forEach(p => {
    data[p] = parseFloat(data[p]);
  });

  // Don't worry about non-R or non-D
  if (['DFL', 'D', 'R'].indexOf(data.party) === -1) {
    return;
  }

  // Standardize DFL
  data.party = data.party === 'DFL' ? 'D' : data.party;

  // Precinct is unique to county
  data.precinctID = data.county + '-' + data.precinct;

  // Precinct and part for easier lookup
  data.precinctPartyID = data.county + '-' + data.precinct + '-' + data.party;

  // Collect only certain sets.
  if (data.contest === proxyContest) {
    collected.proxy.push(data);

    // Helpful for debugging
    if (proxyContestNote !== data.contestName) {
      console.error('Proxied contest: ', data.contestName);
      proxyContestNote = data.contestName;
    }
  }
  else if (data.contestName.match(/state senator/i)) {
    collected.senate.push(data);
  }
  else if (data.contestName.match(/state representative/i)) {
    collected.house.push(data);
  }
  else if (data.contestName.match(/u\.?s\.? representative/i)) {
    collected.congress.push(data);
  }
}

// Parse data for legacy.  Each row is a precinct with
// columns for each race, but we need to make a row for each
// candidate
function parseInputLegacy(data) {
  let base = {
    county: data.CountyID,
    precinct: data[argv.year <= 1998 ? 'FIPS_VTD' : 'Precinct Code']
  };
  base.precinctID = base.county + '-' + base.precinct;

  // Sets
  [
    {
      votesPrefixField: 'CONG',
      districtField: 'CG',
      namePrefix: 'US Congress',
      collection: 'congress'
    },
    {
      votesPrefixField: 'MNSEN',
      // There is no senate field, just the house, which each Senate
      // district is divided into an A and B
      districtField: 'LEG',
      namePrefix: 'MN Senate',
      collection: 'senate'
    },
    {
      votesPrefixField: argv.year <= 1998 ? 'MNLeg' : 'MNLEG',
      districtField: 'LEG',
      namePrefix: 'MN House',
      collection: 'house'
    },
    {
      votesPrefixField: proxyContest ? proxyContest : 'USPRES',
      districtField: '',
      namePrefix: argv['proxy-contest-name']
        ? argv['proxy-contest-name']
        : 'US President',
      collection: 'proxy'
    }
  ].forEach(set => {
    [
      { field: 'R', output: 'R' },
      { field: 'IR', output: 'R' },
      { field: 'D', output: 'D' },
      { field: 'DFL', output: 'D' }
    ].forEach(party => {
      if (
        !data['Precinct Name'].match(/totals/i) &&
        data[set.votesPrefixField + party.field]
      ) {
        // Some hackery (see note above)
        let district =
          set.collection === 'senate'
            ? data[set.districtField].substring(0, 2)
            : data[set.districtField];

        collected[set.collection].push(
          _.extend({}, base, {
            party: party.output,
            votes: parseInt(data[set.votesPrefixField + party.field]),
            totalVotes: parseInt(data[set.votesPrefixField + 'TOT']),
            precinctPartyID: base.precinctID + '-' + party.output,
            district: set.districtField ? data[set.districtField] : null,
            contest: set.districtField ? district : set.votesPrefixField,
            contestName: set.districtField
              ? set.namePrefix + ' District ' + district
              : set.namePrefix
          })
        );

        // Note proxy
        if (set.collection === 'proxy' && proxyContestNote !== set.namePrefix) {
          console.error('Proxying: ', set.namePrefix);
          proxyContestNote = set.namePrefix;
        }
      }
    });
  });
}

// Process the collected data
function processCollected(data) {
  if (!data.proxy || !data.proxy.length) {
    console.error('Nothing collected for proxy.');
  }

  ['congress', 'house', 'senate'].forEach(s => {
    if (!data[s] || !data[s].length) {
      return;
    }

    // Process
    let processed = processDistricts(s, data[s], data.proxy);

    // Output to file
    fs.writeFileSync(
      path.join(__dirname, '..', 'build', argv.year + '-' + s + '-gap.json'),
      JSON.stringify(processed, null, '  ')
    );

    // Output
    console.error(argv.year + ' ' + s + ': ' + processed.totals.gap);
    console.error(processed.totals);
  });

  console.error('Done.');
}

// Process districts
function processDistricts(type, raw, proxy) {
  // Turn proxy into better structure for lookup
  let proxyLookup = _.keyBy(proxy, 'precinctPartyID');

  let districts = _.map(
    _.groupBy(raw, d => {
      return d.contest;
    }),
    g => {
      let precincts = _.groupBy(g, 'precinctID');

      let c = {
        contest: g[0].contest,
        contestName: g[0].contestName,
        precincts: _.size(precincts),
        dVotes: _.sumBy(g, p => {
          return p.party === 'D' ? p.votes : 0;
        }),
        rVotes: _.sumBy(g, p => {
          return p.party === 'R' ? p.votes : 0;
        }),
        totalVotes: _.reduce(
          precincts,
          (total, p) => {
            return total + p[0].totalVotes;
          },
          0
        )
      };

      // Check uncontested
      if (!c.rVotes || !c.dVotes) {
        c.uncontested = true;
      }

      // Add proxy info
      c.proxy = {
        dVotes: _.reduce(
          precincts,
          (total, p) => {
            return (
              total +
              (proxyLookup[p[0].precinctID + '-D']
                ? proxyLookup[p[0].precinctID + '-D'].votes
                : 0)
            );
          },
          0
        ),
        rVotes: _.reduce(
          precincts,
          (total, p) => {
            return (
              total +
              (proxyLookup[p[0].precinctID + '-R']
                ? proxyLookup[p[0].precinctID + '-R'].votes
                : 0)
            );
          },
          0
        )
      };

      // Check for non-d or non-r possible wins
      if (c.totalVotes - (c.rVotes + c.dVotes) > c.rVotes + c.dVotes) {
        console.error('Third-party win maybe: ', c);
        c.thirdParty = true;
      }

      // Some calculations, use proxy for third party or uncontested
      c.proxied = c.thirdParty || c.uncontested;
      c.dEffectiveVotes = c.proxied ? c.proxy.dVotes : c.dVotes;
      c.rEffectiveVotes = c.proxied ? c.proxy.rVotes : c.rVotes;

      // Winner
      c.win = c.dEffectiveVotes > c.rEffectiveVotes ? 'D' : 'R';

      // Wasted votes
      let mid = Math.floor((c.rEffectiveVotes + c.dEffectiveVotes) / 2) + 1;
      c.dWasted = c.win === 'D' ? c.dEffectiveVotes - mid : c.dEffectiveVotes;
      c.rWasted = c.win === 'R' ? c.rEffectiveVotes - mid : c.rEffectiveVotes;

      return c;
    }
  );

  // Calculate totals
  let totals = {
    type: type,
    year: argv.year,
    districts: districts.length,
    proxied: _.filter(districts, 'proxied').length,
    proxyContest: proxyContestNote,
    dTotalWasted: _.sumBy(districts, 'dWasted'),
    rTotalWasted: _.sumBy(districts, 'rWasted'),
    totalVotes: _.sumBy(districts, d => {
      return d.dVotes + d.rVotes;
    }),
    totalEffectiveVotes: _.sumBy(districts, d => {
      return d.dEffectiveVotes + d.rEffectiveVotes;
    })
  };

  // Calculate gap
  totals.gap =
    (totals.dTotalWasted - totals.rTotalWasted) / totals.totalEffectiveVotes;

  return {
    totals: totals,
    districts: districts
  };
}
