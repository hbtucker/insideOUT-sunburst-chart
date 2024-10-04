function _chart(d3, data) {
  // Specify the chart's dimensions.
  const width = 928;
  const height = width;
  const radius = width / 2;

  // Create the color scale with richer colors
  const richerColors = [
    "#FF9AA2", "#A8D8B9", "#8AC6D1", "#FFDAC1", "#E2F0CB",
    "#B5EAD7", "#C7CEEA", "#F6D5E5", "#FFE5B4", "#D4A5A5"
  ];

  const darkerColors = [
    "#8B3A1E", "#A18860", "#A99585", "#517666", "#005D5D",
    "#5A6D90", "#688092", "#809D95", "#96A39C"
  ];

  let color = d3.scaleOrdinal(d3.quantize(d3.interpolateRainbow, data.children.length + 1));

  // Create the partition layout
  const partition = data => {
    const root = d3.hierarchy(data)
        .sum(d => d.value)
        .sort((a, b) => b.value - a.value);
    return d3.partition()
        .size([2 * Math.PI, root.height + 1])
      (root);
  }

  const root = partition(data);

  root.each(d => d.current = d);

  // Create the arc generator
  const arc = d3.arc()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius * 1.5)
      .innerRadius(d => d.y0 * radius)
      .outerRadius(d => Math.max(d.y0 * radius, d.y1 * radius - 1));

  // Create the SVG container
  const svg = d3.create("svg")
      .attr("viewBox", [-width / 2, -height / 2, width, width])
      .style("font", "10px sans-serif");

  // Append the arcs
  const path = svg.append("g")
    .selectAll("path")
    .data(root.descendants().slice(1))
    .join("path")
      .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
      .attr("fill-opacity", d => arcVisible(d.current) ? (d.children ? 0.6 : 0.4) : 0)
      .attr("pointer-events", d => arcVisible(d.current) ? "auto" : "none")
      .attr("d", d => arc(d.current));

  // Make them clickable if they have children
  path.filter(d => d.children)
      .style("cursor", "pointer")
      .on("click", clicked);

  // Function to calculate font size
  function calculateFontSize(d) {
    const node = d.current;
    const angle = node.x1 - node.x0;
    const radius = (node.y0 + node.y1) / 2;
    const circumference = angle * radius;
    const maxFontSize = Math.min(14, circumference / 4);
    const minFontSize = 9;
    return Math.max(minFontSize, maxFontSize);
  }

  // Function to insert line breaks
  function insertLineBreaks(text) {
    const words = text.split(/\s+/);
    let lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i++) {
      if (currentLine.length + words[i].length + 1 <= 10) {
        currentLine += " " + words[i];
      } else {
        lines.push(currentLine);
        currentLine = words[i];
      }
    }
    lines.push(currentLine);
    return lines;
  }

  // Add the labels
  const label = svg.append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .style("user-select", "none")
    .selectAll("text")
    .data(root.descendants().slice(1))
    .join("text")
      .attr("dy", "0.35em")
      .attr("fill-opacity", d => +labelVisible(d.current))
      .attr("transform", d => labelTransform(d.current))
      .style("font-size", d => `${calculateFontSize(d)}px`)
      .each(function(d) {
        const lines = insertLineBreaks(d.data.name);
        d3.select(this).selectAll("tspan")
          .data(lines)
          .join("tspan")
          .attr("x", 0)
          .attr("dy", (_, i) => i === 0 ? "0em" : "1em")
          .text(d => d);
      });

  // Create the center circle
  const parent = svg.append("circle")
      .datum(root)
      .attr("r", radius)
      .attr("fill", "none")
      .attr("pointer-events", "all")
      .on("click", clicked);

  // Handle zoom on click
  function clicked(event, p) {
    parent.datum(p.parent || root);

    root.each(d => d.target = {
      x0: Math.max(0, Math.min(1, (d.x0 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      x1: Math.max(0, Math.min(1, (d.x1 - p.x0) / (p.x1 - p.x0))) * 2 * Math.PI,
      y0: Math.max(0, d.y0 - p.depth),
      y1: Math.max(0, d.y1 - p.depth)
    });

    const t = svg.transition().duration(750);

    path.transition(t)
        .tween("data", d => {
          const i = d3.interpolate(d.current, d.target);
          return t => d.current = i(t);
        })
      .filter(function(d) {
        return +this.getAttribute("fill-opacity") || arcVisible(d.target);
      })
        .attr("fill-opacity", d => arcVisible(d.target) ? (d.children ? 0.6 : 0.4) : 0)
        .attr("pointer-events", d => arcVisible(d.target) ? "auto" : "none")
        .attrTween("d", d => () => arc(d.current));

    label.filter(function(d) {
      return +this.getAttribute("fill-opacity") || labelVisible(d.target);
    }).transition(t)
        .attr("fill-opacity", d => +labelVisible(d.target))
        .attrTween("transform", d => () => labelTransform(d.current))
        .tween("text", function(d) {
          const i = d3.interpolate(d.current, d.target);
          return function(t) {
            d.current = i(t);
            const fontSize = calculateFontSize(d);
            d3.select(this)
              .style("font-size", `${fontSize}px`)
              .attr("transform", labelTransform(d.current));
            
            const lines = insertLineBreaks(d.data.name);
            d3.select(this).selectAll("tspan")
              .data(lines)
              .join("tspan")
              .attr("x", 0)
              .attr("dy", (_, i) => i === 0 ? "0em" : "1em")
              .text(d => d);
          };
        });
  }
  
  function arcVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && d.x1 > d.x0;
  }

  function labelVisible(d) {
    return d.y1 <= 3 && d.y0 >= 1 && (d.y1 - d.y0) * (d.x1 - d.x0) > 0.03;
  }

  function labelTransform(d) {
    const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
    const y = (d.y0 + d.y1) / 2 * radius;
    return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
  }

  // Dark mode toggle functionality
  function updateColors(isDarkMode) {
    const textColor = isDarkMode ? 'white' : 'black';
    const backgroundColor = isDarkMode ? '#202020' : '#fff';
    
    color = d3.scaleOrdinal(isDarkMode ? darkerColors : richerColors);

    svg.style("background", backgroundColor);

    path.attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); });

    label.attr("fill", textColor);

    // Update logo
    const logo = document.getElementById('logo');
    if (logo) {
      logo.src = isDarkMode ? 'dark-logo.png' : 'logo.png';
    }
  }

  // Set up event listener for dark mode toggle
  const darkModeToggle = document.getElementById('darkModeToggle');
  if (darkModeToggle) {
    darkModeToggle.addEventListener('click', () => {
      const isDarkMode = document.body.classList.toggle('dark-mode');
      updateColors(isDarkMode);
    });
  }

  return svg.node();
}

function _data(FileAttachment) {
  return FileAttachment("data.json").json();
}

export default function define(runtime, observer) {
  const main = runtime.module();
  function toString() { return this.url; }
  const fileAttachments = new Map([
    ["data.json", {url: new URL("./data/data.json", import.meta.url), mimeType: "application/json", toString}]
  ]);
  main.builtin("FileAttachment", runtime.fileAttachments(name => fileAttachments.get(name)));
  main.variable(observer("chart")).define("chart", ["d3","data"], _chart);
  main.variable(observer("data")).define("data", ["FileAttachment"], _data);
  return main;
}
