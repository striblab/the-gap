/**
 * Main JS file for project.
 */

// Define globals that are added through the config.json file, here like this:
/* global _, d3, topojson */
'use strict';

// Dependencies
import utilsFn from './utils.js';

// Import local ES6 modules like this:
//import utilsFn from './utils.js';

// Or import libraries installed with npm like this:
// import module from 'module';

// Setup utils function
let utils = utilsFn({});

// Cache for data
let cache = {};

// Draw
drawAnalysis('2016-congress', '2012-congress', cache);
drawAnalysis('2014-congress', '2012-congress', cache);
drawAnalysis('2012-congress', '2012-congress', cache);
drawAnalysis('2010-congress', '2002-congress', cache);
drawAnalysis('2008-congress', '2002-congress', cache);
drawAnalysis('2006-congress', '2002-congress', cache);

drawAnalysis('2016-senate', '2012-senate', cache);
drawAnalysis('2012-senate', '2012-senate', cache);
drawAnalysis('2010-senate', '2002-senate', cache);
drawAnalysis('2006-senate', '2002-senate', cache);

drawAnalysis('2016-house', '2012-house', cache);
drawAnalysis('2014-house', '2012-house', cache);
drawAnalysis('2012-house', '2012-house', cache);
drawAnalysis('2010-house', '2002-house', cache);
drawAnalysis('2008-house', '2002-house', cache);
drawAnalysis('2006-house', '2002-house', cache);
drawAnalysis('1998-house', '1994-house', cache);
drawAnalysis('1996-house', '1994-house', cache);

// Draw analysis
function drawAnalysis(resultSet, districtSet = '2012-congress', cache) {
  fetchAnalysisSet(resultSet, districtSet, cache)
    .catch(error => {
      console.error(error);
    })
    .then(({ results, districts }) => {
      districts = matchDistricts(resultSet, results, districts);

      // Selector and container
      let selector = `.gap-visual-${resultSet}`;
      let container = d3.select(selector);

      // Scales
      let colorScaleR = d3
        .scaleQuantize()
        .domain([0, 0.3])
        .range(['#F2614C', '#9C0004']);
      let colorScaleD = d3
        .scaleQuantize()
        .domain([0, 0.3])
        .range(['#67B4C2', '#0D4673']);

      // Legend
      // Manually handled

      // Analysis
      container
        .select('.efficency-gap-lean-party')
        .text(results.totals.gap < 0 ? 'Democract' : 'Republican');
      container
        .select('.efficency-gap-percent')
        .text(d3.format('.1%')(Math.abs(results.totals.gap)));
      container
        .select('.dem-votes')
        .text(d3.format(',')(results.totals.dVotes));
      container
        .select('.rep-votes')
        .text(d3.format(',')(results.totals.rVotes));
      container.select('.dem-wins').text(d3.format(',')(results.totals.dWins));
      container.select('.rep-wins').text(d3.format(',')(results.totals.rWins));
      container.select('.proxy-count').text(results.totals.proxied);
      container.select('.proxy-again').text(results.totals.proxiedAgain);
      container.select('.proxy-contest').text(results.totals.proxyContest);

      // Map
      let margin = { top: 10, right: 10, bottom: 10, left: 10 };
      let width = 960 - margin.left - margin.right;
      let height = 600 - margin.top - margin.bottom;
      let projection = d3.geoAlbersUsa().fitSize([width, height], districts);
      let path = d3.geoPath().projection(projection);

      let svg = container
        .select('.map')
        .append('svg')
        .attr('preserveAspectRatio', 'xMinYMin meet')
        .attr(
          'viewBox',
          `0 0 ${width + margin.left + margin.right} ${height +
            margin.top +
            margin.bottom}`
        )
        .classed('map-canvas', true)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      svg
        .append('g')
        .selectAll('path')
        .data(districts.features)
        .enter()
        .append('path')
        .attr('d', path)
        .style('fill', d => {
          //console.log(d.properties);
          if (!d.properties) {
            return '#EDEDED';
          }

          let margin =
            (d.properties.rEffectiveVotes - d.properties.dEffectiveVotes) /
            (d.properties.rEffectiveVotes + d.properties.dEffectiveVotes);

          return margin > 0
            ? colorScaleR(Math.abs(margin))
            : colorScaleD(Math.abs(margin));
        })
        .style('stroke-width', 1)
        .style('stroke', '#EDEDED');
    });
}

// Match districts with data from results
function matchDistricts(resultSet, results, districts) {
  districts = utils.deepClone(districts);

  if (resultSet.match(/20..-(congress|senate)/)) {
    districts.features = _.map(districts.features, f => {
      let resultsData = _.find(results.districts, d => {
        return (
          parseInt(f.properties.DISTRICT, 10) ===
          parseInt(d.contestName.match(/([0-9.]+)$/)[1], 10)
        );
      });

      f.properties = resultsData;
      return f;
    });
  }
  else if (resultSet.match(/....-house/)) {
    districts.features = _.map(districts.features, f => {
      let resultsData = _.find(results.districts, d => {
        let contestMatch = d.contestName.match(/([0-9]+[A-Z]+)$/);

        if (!contestMatch) {
          //console.log(d);
          return false;
        }
        else {
          return (
            f.properties.DISTRICT.replace(/^[0]+/, '') ===
            contestMatch[1].replace(/^[0]+/, '')
          );
        }
      });

      f.properties = resultsData;
      return f;
    });
  }

  return districts;
}

// Get data
function fetchAnalysisSet(resultSet, districtSet = '2012-congress', cache) {
  let gapData = `./assets/data/${resultSet}-gap.json`;
  let districtsData = `./assets/data/districts-${districtSet}.topo.json`;

  return new Promise((resolve, reject) => {
    if (cache[gapData] && cache[districtsData]) {
      return resolve({
        results: cache[gapData],
        districts: cache[districtsData]
      });
    }
    else if (cache[gapData] && !cache[districtsData]) {
      d3.json(districtsData, (error, d) => {
        if (error) {
          return reject(error);
        }

        cache[districtsData] = topojson.feature(d, d.objects['-']);
        return resolve({
          results: cache[gapData],
          districts: cache[districtsData]
        });
      });
    }
    else if (!cache[gapData] && cache[districtsData]) {
      d3.json(gapData, (error, d) => {
        if (error) {
          return reject(error);
        }

        cache[gapData] = d;
        return resolve({
          results: cache[gapData],
          districts: cache[districtsData]
        });
      });
    }
    else {
      d3.json(gapData, (error, d) => {
        if (error) {
          return reject(error);
        }

        cache[gapData] = d;
        d3.json(districtsData, (error, d) => {
          if (error) {
            return reject(error);
          }

          cache[districtsData] = topojson.feature(d, d.objects['-']);
          return resolve({
            results: cache[gapData],
            districts: cache[districtsData]
          });
        });
      });
    }
  });
}
