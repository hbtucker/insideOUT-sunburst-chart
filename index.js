import createChart from './sunburst.js';

// Fetch the data and create the chart
fetch('./data/data.json')
  .then(response => response.json())
  .then(data => {
    const chartElement = createChart(data);
    document.getElementById('chart').appendChild(chartElement);
  });
