function _chart(d3, data) {
  // Specify the chart's dimensions.
  const width = 928;
  const height = width;
  const radius = width / 12;

  // Create the color scale with richer colors
  const richerColors = [
    "#FF9AA2", "#A8D8B9", "#8AC6D1", "#FFDAC1", "#E2F0CB",
    "#B5EAD7", "#C7CEEA", "#F6D5E5", "#FFE5B4", "#D4A5A5"
  ];

  const darkerColors = [
    "#8B3A1E", "#A18860", "#A99585", "#517666", "#005D5D",
    "#5A6D90", "#688092", "#809D95", "#96A39C"
  ];

  let color = d3.scaleOrdinal()
    .domain(data.children.map(d => d.name))
    .range(richerColors);

  // Compute the layout.
  const root = d3.hierarchy(data)
    .sum(d => d.value)
    .sort((a, b) => b.value - a.value);
  const partition = d3.partition()
    .size([2 * Math.PI, radius * radius]);
  partition(root);

  // Create the arc generator.
  const arc = d3.arc()
    .startAngle(d => d.x0)
    .endAngle(d => d.x1)
    .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
    .padRadius(radius / 2)
    .innerRadius(d => Math.sqrt(d.y0))
    .outerRadius(d => Math.sqrt(d.y1) - 1);

  // Create the SVG container.
  const svg = d3.create("svg")
    .attr("viewBox", [-width / 2, -height / 2, width, width])
    .style("font", "10px sans-serif");

  // Append the arcs.
  const path = svg.append("g")
    .selectAll("path")
    .data(root.descendants().filter(d => d.depth))
    .join("path")
    .attr("fill", d => { while (d.depth > 1) d = d.parent; return color(d.data.name); })
    .attr("fill-opacity", d => arcVisible(d) ? (d.children ? 0.6 : 0.4) : 0)
    .attr("d", arc);

  // Make them clickable if they have children.
  path.filter(d => d.children)
    .style("cursor", "pointer")
    .on("click", clicked);

  // Add the labels.
  const label = svg.append("g")
    .attr("pointer-events", "none")
    .attr("text-anchor", "middle")
    .style("user-select", "none")
    .selectAll("text")
    .data(root.descendants().filter(d => d.depth && (d.y0 + d.y1) / 2 * (d.x1 - d.x0) > 10))
    .join("text")
    .attr("dy", "0.35em")
    .attr("fill-opacity", d => +labelVisible(d))
    .attr("transform", d => labelTransform(d))
    .text(d => d.data.name);

  // Add the center circle for returning to the root.
  const parent = svg.append("circle")
    .datum(root)
    .attr("r", radius)
    .attr("fill", "none")
    .attr("pointer-events", "all")
    .on("click", clicked);

  // Handle zoom on click.
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
      .attrTween("d", d => () => arc(d.current));

    label.filter(function(d) {
      return +this.getAttribute("fill-opacity") || labelVisible(d.target);
    }).transition(t)
      .attr("fill-opacity", d => +labelVisible(d.target))
      .attrTween("transform", d => () => labelTransform(d.current));
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
    
    color.range(isDarkMode ? darkerColors : richerColors);

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
