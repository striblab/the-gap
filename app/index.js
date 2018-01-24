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
utilsFn({});

d3.json('./assets/data/2016-congress-gap.json', (error, gap) => {
  if (error) {
    throw new Error(error);
  }

  d3.json(
    './assets/data/districts-2012-congress.topo.json',
    (error, topology) => {
      if (error) {
        throw new Error(error);
      }

      gap.districts = _.map(gap.districts, d => {
        d.districtID = d.contestName.match(/([0-9]+)$/)[1];
        return d;
      });

      let container = d3.select('.congress-2016-gap-visual');

      let margin = { top: 10, right: 10, bottom: 10, left: 10 };
      let width = 960 - margin.left - margin.right;
      let height = 600 - margin.top - margin.bottom;

      let geojson = topojson.feature(topology, topology.objects['-']);

      let projection = d3.geoAlbersUsa().fitSize([width, height], geojson);
      let path = d3.geoPath().projection(projection);

      let colorScaleR = d3
        .scaleQuantize()
        .domain([0, 0.3])
        .range(['#F2614C', '#9C0004']);
      let colorScaleD = d3
        .scaleQuantize()
        .domain([0, 0.3])
        .range(['#67B4C2', '#0D4673']);

      let svg = container
        .select('.map')
        .append('svg')
        .attr('width', width + margin.left + margin.right)
        .attr('height', height + margin.top + margin.bottom)
        .append('g')
        .attr('transform', 'translate(' + margin.left + ',' + margin.top + ')');

      svg
        .append('g')
        .selectAll('path')
        .data(geojson.features)
        .enter()
        .append('path')
        .attr('d', path)
        .style('fill', d => {
          let district = _.find(gap.districts, {
            districtID: d.properties.DISTRICT
          });
          let margin =
            (district.rEffectiveVotes - district.dEffectiveVotes) /
            (district.rEffectiveVotes + district.dEffectiveVotes);
          console.log(district, margin);
          return margin < 0
            ? colorScaleR(Math.abs(margin))
            : colorScaleD(margin);
        })
        .style('stroke-width', 1)
        .style('stroke', '#EDEDED');
    }
  );
});
